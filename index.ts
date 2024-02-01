import { IncomingMessage } from 'http';

import Logger from 'bunyan';
import Redis, { Redis as RedisInterface, RedisOptions } from 'ioredis';
import sequelize, { Sequelize } from 'sequelize';
import {
    Connection as TypeOrmConnection,
    ConnectionOptions as TypeOrmConnectionOptions,
    createConnection as TypeOrmCreateConnection
} from 'typeorm';
import Waterline, {
    Connection as WaterlineConnection,
    ConfigOptions as WaterlineConfigOptions,
    Collection as WaterlineCollection
} from 'waterline';

import { map, parallel } from 'async';

import { model_route_to_map } from '@offscale/nodejs-utils';

import { IOrmMwConfig, IOrmReq, IOrmsOut, IWaterlineAdapter, Program, RequestHandler } from './interfaces.d';
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
            else if (typeof program[entity] === 'function') {
                const program_str = program[entity].toString();
                if (program_str.indexOf('sequelize') > -1)
                    sequelize_map.set(entity, program[entity]);
                else if (program_str.indexOf('class') > -1)
                    typeorm_map.set(entity, program[entity]);
                else norm_set.add(entity);
            } else
                norm_set.add(entity);
        });

const redisHandler = (orm: { skip: boolean, config?: RedisOptions | string },
                      logger: Logger,
                      callback: (err: Error | null | undefined | unknown, ...args: any[]) => void) => {
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

const sequelizeHandler = (orm: { skip: boolean, uri?: string, config?: sequelize.Options, map: Map<string, Program> },
                          logger: Logger, callback: (err: Error | null | undefined | unknown, ...args: any[]) => void) => {
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
                            config?: TypeOrmConnectionOptions,
                            map: Map<string, Program>
                        },
                        logger: Logger, callback: (err: Error | null | undefined | unknown, ...args: any[]) => void) => {
    if (orm.skip) return callback(void 0);

    logger.info('TypeORM initialising with:\t', Array.from(orm.map.keys()), ';');
    try { // TODO: `uri` handling
        return TypeOrmCreateConnection(Object.assign({
                name: orm.name || 'default',
                entities: Array.from(orm.map.values())
            }, orm.config
        ))
            .then(connection => callback(void 0, { connection }))
            .catch(callback);
    } catch (e) {
        return callback(e);
    }
};

const waterlineHandler = (orm: { skip: boolean, config?: WaterlineConfigOptions, set: Set<string> },
                          logger: Logger, callback: (err: Error | null | undefined | unknown, ...args: any[]) => void) => {
    if (orm.skip) return callback(void 0);
    else if (orm.config == null) return callback(new Error('No config provided to waterlineHandler'));

    // @ts-ignore
    const waterline_obj = new Waterline();
    // Create/init database models and populates exported `waterline_collections`
    Array
        .from(orm.set.values())
        .forEach(e => waterline_obj.loadCollection(WaterlineCollection.extend(e)));
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
        return callback(void 0, { datastore: ontology.connections, collections: ontology.collections });
    });
};

export const tearDownRedisConnection = (connection: Redis.Redis, done: (error?: any) => any) =>
    connection == null ? done(void 0) : done(connection.disconnect());

export const tearDownSequelizeConnection = (connection: sequelize.Sequelize, done: (error?: any) => any) =>
    connection == null ? done(void 0) : done(connection.close());

export const tearDownTypeOrmConnection = (connection: TypeOrmConnection, done: (error?: any) => any) =>
    connection == null || !connection.isConnected ? done(void 0) : connection.close().then(_ => done()).catch(done);

export const tearDownWaterlineConnection = (connections: Array<WaterlineConnection & IWaterlineAdapter>,
                                            done: (error?: any) => any) =>
    connections ? parallel(Object.keys(connections).map(
        connection => connections[parseInt(connection, 10)]._adapter!.teardown
    ), () => {
        Object.keys(connections).forEach(connection => {
            const connection_idx = parseInt(connection, 10)
            if (['sails-tingo', 'waterline-nedb'].indexOf(connections[connection_idx]._adapter!.identity) < 0)
                connections[connection_idx]._adapter!.connections.delete(connection);
        });
        return done();
    }) : done();

export const tearDownConnections = (orms: IOrmsOut, done: (error?: any) => any) =>
    orms == null ? done(void 0) : parallel({
        redis: cb => tearDownRedisConnection((orms.redis! || { connection: undefined }).connection, cb),
        sequelize: cb => tearDownSequelizeConnection((orms.sequelize! || { connection: undefined }).connection, cb),
        typeorm: cb => tearDownTypeOrmConnection((orms.typeorm! || { connection: undefined }).connection, cb),
        waterline: cb => tearDownWaterlineConnection((orms.waterline! || { connection: { _adapter: undefined } }).connection, cb)
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
        .some(orm => (options.orms_in as typeof options.orms_in & {
            [key: string]: { skip: boolean }
        })[orm].skip === false);

    if (!do_models) {
        options.logger.warn('Not registering any ORMs or cursors');
        const mw = (req: any, res: any, next: any) => next();
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
            redisHandler(options.orms_in.redis, options.logger, cb as (err: unknown, ...args: any[]) => void),
        sequelize: cb => options.orms_in.sequelize == null ? cb(void 0) :
            sequelizeHandler(Object.assign(options.orms_in.sequelize, { map: sequelize_map }), options.logger,
                cb as (err: unknown, ...args: any[]) => void),
        typeorm: cb => options.orms_in.typeorm == null ? cb(void 0)
            : typeormHandler(Object.assign(options.orms_in.typeorm,
                    { map: typeorm_map, name: options.connection_name }),
                options.logger, cb as (err: unknown, ...args: any[]) => void),
        waterline: cb => options.orms_in.waterline == null ? cb(void 0) :
            waterlineHandler(Object.assign(options.orms_in.waterline, { set: waterline_set }), options.logger,
                cb as (err: unknown, ...args: any[]) => void),
    }, (err: Error | undefined, orms_out: IOrmsOut) => {
        if (err != null) {
            if (options.callback != null) return options.callback(err);
            throw err;
        }

        // @ts-ignore
        const mw: RequestHandler = (req: IncomingMessage & IOrmReq, res, next) => {
            req.getOrm = () => orms_out;
            req.orms_out = orms_out;
            return next();
        };
        if (options.callback == null) return mw;
        return options.callback(void 0, mw, orms_out);
    });
};
