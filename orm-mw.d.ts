import * as bunyan from 'bunyan';
import * as redis from 'ioredis';
import * as sequelize from 'sequelize';
import * as typeorm from 'typeorm';
import * as waterline from 'waterline';

import { NextHandleFunction as ConnectRequestHandler } from 'connect';
import { RequestHandler as ExpressRequestHandler } from 'express';
import { RequestHandler as RestifyRequestHandler } from 'restify';

export type RequestHandler = ConnectRequestHandler | ExpressRequestHandler | RestifyRequestHandler;
export type Program = any;

export interface IOrmsIn {
    redis?: {
        skip: boolean;
        config?: redis.RedisOptions | string;
    };
    sequelize?: {
        skip: boolean;
        uri?: string;
        config?: sequelize.Options;
    };
    typeorm?: {
        skip: boolean;
        config?: typeorm.ConnectionOptions;
    };
    waterline?: {
        skip: boolean;
        config?: waterline.ConfigOptions;
    };
}

export interface IOrmsOut {
    redis?: {
        connection: redis.Redis
    };
    sequelize?: {
        connection: sequelize.Sequelize,
        entities?: Map<string, /*sequelize.Instance<{}> &*/ sequelize.Model<{}, {}>>
    };
    typeorm?: {
        connection: typeorm.Connection
    };
    waterline?: {
        connection: waterline.Connection[],
        collections?: waterline.Query[]
    };
}

export interface IOrmMwConfig {
    models: Map<string, any>;

    omit_models?: string[];
    orms_in: IOrmsIn;
    callback?: (err: Error, mw?: RequestHandler, orms_out?: IOrmsOut) => void;

    logger: bunyan;
}

export interface IOrmReq {
    getOrm: () => IOrmsOut;
    orms_out: IOrmsOut;
}

export declare const tearDownRedisConnection: (connection: redis.Redis, done: (error?: any) => any) => any;
export declare const tearDownSequelizeConnection: (connection: sequelize.Sequelize, done: (error?: any) => any) => any;
export declare const tearDownTypeOrmConnection: (connection: typeorm.Connection, done: (error?: any) => any) => any;
export declare const tearDownWaterlineConnection: (connections: waterline.Connection[],
                                                   done: (error?: any) => any) => any;
export declare const tearDownConnections: (orms: IOrmsOut, done: (error?: any) => any) => void;
export declare const ormMw: (options?: IOrmMwConfig) => RequestHandler | void;
