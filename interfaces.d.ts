import bunyan from 'bunyan';
import { Options as SequelizeOptions, Sequelize } from 'sequelize';
import { Connection as TypeOrmConnection, ConnectionOptions as TypeOrmConnectionOptions } from 'typeorm';
import {
    ConfigOptions as WaterlineConfigOptions,
    Connection as WaterlineConnection,
    Query as WaterlineQuery
} from 'waterline';
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
        config?: SequelizeOptions;
    };
    typeorm?: {
        skip: boolean;
        config?: TypeOrmConnectionOptions;
        name?: string;
    };
    waterline?: {
        skip: boolean;
        config?: WaterlineConfigOptions;
    };
}

export interface IWaterlineAdapter {
    _adapter?: { teardown: any, identity: string, connections: any } | null | undefined
}

export interface IOrmsOut {
    redis?: {
        connection: RedisInterface
    };
    sequelize?: {
        connection: Sequelize,
        entities?: Map<string, /*sequelize.Instance<{}> &*/ SequelizeOptions>
    };
    typeorm?: {
        connection: TypeOrmConnection
    };
    waterline?: {
        connection: Array<WaterlineConnection & IWaterlineAdapter>,
        collections?: WaterlineQuery[]
    };
}

export interface IOrmMwConfig {
    models: Map<string, any>;

    omit_models?: string[];
    orms_in: IOrmsIn;
    callback?: (err?: Error, mw?: RequestHandler, orms_out?: IOrmsOut) => void;

    logger: bunyan;

    connection_name?: string;
}

export interface IOrmReq {
    getOrm: () => IOrmsOut;
    orms_out: IOrmsOut;
}
