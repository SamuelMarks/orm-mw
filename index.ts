import * as http from 'http';

import * as Logger from 'bunyan';
import Redis, { Redis as RedisInterface, RedisOptions } from 'ioredis';
import * as sequelize from 'sequelize';
import { Sequelize } from 'sequelize';
import * as typeorm from 'typeorm';
import * as Waterline from 'waterline';

import { map, parallel } from 'async';

import { model_route_to_map } from '@offscale/nodejs-utils';

import { IOrmMwConfig, IOrmReq, IOrmsOut, Program, RequestHandler } from './interfaces.d';
import { bunyan } from 'restify';

const populateModels = (program: any,
                        omit_models: string[],
                        norm_set: Set<any>,
                        waterline_set: Set<any>,
                        typeorm_map: Map<string, Program>,
                        sequelize_map: Map<string, Program>) =>
    Object
        .keys(program)
        .filter(entity => program[entity] != null && omit_models.indexOf(entity) === -1)
        .forEach(entity => {
            if (program[entity].identity || program[entity].tableName)
                waterline_set.add(program[entity]);
            else if (typeof program[entity] === 'function')
                if (program[entity].toString().indexOf('sequelize') > -1)
                    sequelize_map.set(entity, program[entity]);
                else if (program[entity].toString().indexOf('class') > -1)
                    typeorm_map.set(entity, program[entity]);
                else norm_set.add(entity);
            else norm_set.add(entity);
        });

const redisHandler = (orm: {skip: boolean, config?: RedisOptions | string},
                      logger: Logger, callback: (err, ...args) => void) => {
    if (orm.skip) return callback(void 0);

    const cursor: RedisInterface = new Redis(orm.config as RedisOptions);
    cursor.on('error', err => {
        logger.error(`Redis::error event - ${cursor['options']['host']}:${cursor['options']['port']} - ${err}`);
        logger.error(err);
        return callback(err); // TODO: Check if `callback` has been called
    });
    cursor.on('connect', () => {
        logger.info(`Redis client connected to:\t ${cursor['options']['host']}:${cursor['options']['port']}`);
        return callback(void 0, { connection: cursor });
    });
};

const sequelizeHandler = (orm: {skip: boolean, uri?: string, config?: sequelize.Options, map: Map<string, Program>},
                          logger: Logger, callback: (err, ...args) => void) => {
    if (orm.skip) return callback(void 0);

    logger.info('Sequelize initialising with:\t', Array.from(orm.map.keys()), ';');
    const sequelize_obj: sequelize.Sequelize = new sequelize['Sequelize'](orm.uri!, orm.config);

    const entities = new Map<string, /*sequelize.Instance<{}> &*/ sequelize.Model<{}, {}>>();
    for (const [entity, program] of orm.map)
        entities.set(entity, program(sequelize_obj, orm.map));

    sequelize_obj
        .authenticate()
        .then(() => map(
            Array.from(entities.keys()),
            (entity_name, cb) =>
                sequelize_obj
                    .sync(entities.get(entity_name) as any)
                    .then(_ => cb(void 0))
                    .catch(cb),
            err => callback(err, { connection: sequelize_obj, entities })
        ))
        .catch(callback);
};

const typeormHandler = (orm: {
                            skip: boolean,
                            uri?: string,
                            name?: string,
                            config?: typeorm.ConnectionOptions,
                            map: Map<string, Program>
                        },
                        logger: Logger, callback: (err, ...args) => void) => {
    if (orm.skip) return callback(void 0);

    logger.info('TypeORM initialising with:\t', Array.from(orm.map.keys()), ';');
    try { // TODO: `uri` handling
        return typeorm.createConnection(Object.assign({
                name: name || 'default',
                entities: Array.from(orm.map.values())
            }, orm.config
        )).then(connection => callback(null, { connection })).catch(callback);
    } catch (e) {
        return callback(e);
    }
};

const waterlineHandler = (orm: {skip: boolean, config?: Waterline.ConfigOptions, set: Set<string>},
                          logger: Logger, callback: (err, ...args) => void) => {
    if (orm.skip) return callback(void 0);

    // @ts-ignore
    const waterline_obj = new Waterline();
    // Create/init database models and populates exported `waterline_collections`
    Array
        .from(orm.set.values())
        .forEach(e => waterline_obj.loadCollection(Waterline.Collection.extend(e)));
    waterline_obj.initialize(orm.config, (err, ontology) => {
        if (err != null)
            return callback(err);
        else if (ontology == null || ontology.connections == null || ontology.collections == null
            || ontology.connections.length === 0 || ontology.collections.length === 0) {
            logger.error('waterline_obj.initialize::ontology =', ontology, ';');
            return callback(new TypeError('Expected ontology with connections & waterline_collections'));
        }

        // Tease out fully initialised models.
        logger.info('Waterline initialised with:\t', Object.keys(ontology.collections), ';');
        return callback(null, { datastore: ontology.connections, collections: ontology.collections });
    });
};

export const tearDownRedisConnection = (connection: Redis.Redis, done: (error?: any) => any) =>
    connection == null ? done(void 0) : done(connection.disconnect());

export const tearDownSequelizeConnection = (connection: sequelize.Sequelize, done: (error?: any) => any) =>
    connection == null ? done(void 0) : done(connection.close());

export const tearDownTypeOrmConnection = (connection: typeorm.Connection, done: (error?: any) => any) =>
    connection == null || !connection.isConnected ? done(void 0) : connection.close().then(_ => done()).catch(done);

export const tearDownWaterlineConnection = (connections: Waterline.Connection[], done: (error?: any) => any) =>
    connections ? parallel(Object.keys(connections).map(
        connection => connections[connection]._adapter.teardown
    ), () => {
        Object.keys(connections).forEach(connection => {
            if (['sails-tingo', 'waterline-nedb'].indexOf(connections[connection]._adapter.identity) < 0)
                connections[connection]._adapter.connections.delete(connection);
        });
        return done();
    }) : done();

export const tearDownConnections = (orms: IOrmsOut, done: (error?: any) => any) =>
    orms == null ? done(void 0) : parallel({
        redis: cb => tearDownRedisConnection((orms.redis! || { connection: undefined }).connection, cb),
        sequelize: cb => tearDownSequelizeConnection((orms.sequelize! || { connection: undefined }).connection, cb),
        typeorm: cb => tearDownTypeOrmConnection((orms.typeorm! || { connection: undefined }).connection, cb),
        waterline: cb => tearDownWaterlineConnection((orms.waterline! || { connection: undefined }).connection, cb)
    }, done);

export const ormMw = (options: IOrmMwConfig): RequestHandler | void => {
    const norm = new Set<string>();
    const waterline_set = new Set<Program>();
    const typeorm_map = new Map<string, Program>();
    const sequelize_map = new Map<string, Program>();

    if (options.logger == null) options.logger = bunyan.createLogger('orm-mw');

    const do_models: boolean = options.orms_in == null ? false : Object
        .keys(options.orms_in)
        .filter(orm => orm !== 'Redis')
        .some(orm => options.orms_in[orm].skip === false);

    if (!do_models) {
        options.logger.warn('Not registering any ORMs or cursors');
        const mw = (req, res, next) => next();
        if (options.callback == null) return mw;
        return options.callback(void 0, mw, {});
    }

    if (!(options.models instanceof Map))
        options.models = model_route_to_map(options.models);
    for (const [fname, program] of options.models as Map<string, Program>)
        if (program != null && fname.indexOf('model') > -1 && do_models)
            populateModels(
                program, options.omit_models || ['AccessToken'], norm,
                waterline_set, typeorm_map, sequelize_map
            );

    options.logger.warn('Failed registering models:\t', Array.from(norm.keys()), ';');

    parallel({
        redis: cb => options.orms_in.redis == null ? cb(void 0) :
            redisHandler(options.orms_in.redis, options.logger, cb),
        sequelize: cb => options.orms_in.sequelize == null ? cb(void 0) :
            sequelizeHandler(Object.assign(options.orms_in.sequelize, { map: sequelize_map }), options.logger, cb),
        typeorm: cb => options.orms_in.typeorm == null ? cb(void 0) :
            typeormHandler(Object.assign(options.orms_in.typeorm, { map: typeorm_map }), options.logger, cb),
        waterline: cb => options.orms_in.waterline == null ? cb(void 0) :
            waterlineHandler(Object.assign(options.orms_in.waterline, { set: waterline_set }), options.logger, cb),
    }, (err: Error | undefined, orms_out: IOrmsOut) => {
        if (err != null) {
            if (options.callback != null) return options.callback(err);
            throw err;
        }

        // @ts-ignore
        const mw: RequestHandler = (req: http.IncomingMessage & IOrmReq, res, next) => {
            req.getOrm = () => orms_out;
            req.orms_out = orms_out;
            return next();
        };
        if (options.callback == null) return mw;
        return options.callback(void 0, mw, orms_out);
    });
};
