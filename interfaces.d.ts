import * as bunyan from 'bunyan';
import * as sequelize from 'sequelize';
import * as typeorm from 'typeorm';
import * as waterline from 'waterline';
import { Redis as RedisInterface, RedisOptions } from 'ioredis';

import { NextHandleFunction as ConnectRequestHandler } from 'connect';
import { RequestHandler as ExpressRequestHandler } from 'express';
import { RequestHandler as RestifyRequestHandler } from 'restify';

export type RequestHandler = ConnectRequestHandler | ExpressRequestHandler | RestifyRequestHandler;
export type Program = any;

export interface IOrmsIn {
    redis?: {
        skip: boolean;
        config?: RedisOptions | string;
    };
    sequelize?: {
        skip: boolean;
        uri?: string;
        config?: sequelize.Options;
    };
    typeorm?: {
        skip: boolean;
        config?: typeorm.ConnectionOptions;
        name?: string;
    };
    waterline?: {
        skip: boolean;
        config?: waterline.ConfigOptions;
    };
}

export interface IOrmsOut {
    redis?: {
        connection: RedisInterface
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
    callback?: (err?: Error, mw?: RequestHandler, orms_out?: IOrmsOut) => void;

    logger: bunyan;
}

export interface IOrmReq {
    getOrm: () => IOrmsOut;
    orms_out: IOrmsOut;
}
