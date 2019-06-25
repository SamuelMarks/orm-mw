orm-mw
======

Generic--connect, restify, express--middleware adding connection to 0-k ORMs to a `.getDb` method on `req`.

Supported ORMs:

 - [Sequelize](https://github.com/sequelize/sequelize)
 - [TypeORM](https://github.com/typeorm/typeorm)
 - [Waterline](https://github.com/balderdashy/waterline)
 
Supported cursors:

 - [Redis](https://github.com/luin/ioredis)

## Install

    npm i -S @offscale/orm-mw

## Usage

    import { ormMw } from '@offscale/orm-mw';

    server.use(ormMw(/*IOrmMwConfig*/));

### Explicit cleanup
Essentially only useful for tests:

    import { tearDownConnections } from '@offscale/orm-mw';
    
    tearDownConnections(/*ormsInArgs*/, err => {
        if (err != null) throw err; 
    });

## Configuration

See `IOrmMwConfig` interface in [orm-mw.d.ts](https://github.com/SamuelMarks/orm-mw).

## Extending

Adding a new ORM? - Expand the `IOrmMwConfig` interface, and add a new short-function that implements it. See others for reference.

### Development setup
Install the latest Node.JS, `npm i -g typings typescript`, then:

    git clone https://github.com/SamuelMarks/orm-mw
    cd orm-mw
    typings i
    npm test

## Future work

  - Add more ORMs and cursors

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
