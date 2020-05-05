/// <reference types="connect" />
/// <reference types="express" />
import Redis from 'ioredis';
import * as sequelize from 'sequelize';
import * as typeorm from 'typeorm';
import * as Waterline from 'waterline';
import { IOrmMwConfig, IOrmsOut } from './interfaces.d';
export declare const tearDownRedisConnection: (connection: Redis.Redis, done: (error?: any) => any) => any;
export declare const tearDownSequelizeConnection: (connection: sequelize.Sequelize, done: (error?: any) => any) => any;
export declare const tearDownTypeOrmConnection: (connection: typeorm.Connection, done: (error?: any) => any) => any;
export declare const tearDownWaterlineConnection: (connections: Waterline.Connection[], done: (error?: any) => any) => any;
export declare const tearDownConnections: (orms: IOrmsOut, done: (error?: any) => any) => any;
export declare const ormMw: (options: IOrmMwConfig) => void | import("connect").NextHandleFunction | import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("express-serve-static-core").Query> | import("restify").RequestHandler;
