/// <reference types="connect" />
/// <reference types="express" />
import * as Redis from 'ioredis';
import * as sequelize from 'sequelize';
import * as typeorm from 'typeorm';
import * as Waterline from 'waterline';
import { IOrmMwConfig, IOrmsOut } from './interfaces.d';
export declare const tearDownRedisConnection: (connection: Redis.Redis, done: (error?: any) => any) => any;
export declare const tearDownSequelizeConnection: (connection: sequelize.Sequelize, done: (error?: any) => any) => any;
export declare const tearDownTypeOrmConnection: (connection: typeorm.Connection, done: (error?: any) => any) => any;
export declare const tearDownWaterlineConnection: (connections: Waterline.Connection[], done: (error?: any) => any) => any;
export declare const tearDownConnections: (orms: IOrmsOut, done: (error?: any) => any) => any;
export declare const ormMw: (options: IOrmMwConfig) => void | import("restify").RequestHandler | import("connect").NextHandleFunction | import("express").RequestHandler;
