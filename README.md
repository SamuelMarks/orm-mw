orm-mw
======

Generic--connect, restify, express--middleware adding connection to 0-k ORMs to a `.getDb` method on `req`.

Supported ORMs:

 - [Sequelize](https://github.com/sequelize/sequelize)
 - [TypeORM](https://github.com/typeorm/typeorm)
 - [Waterline](https://github.com/balderdashy/waterline)
 
Supported cursors:

 - [Redis](https://github.com/luin/ioredis)

## Usage

    import { ormMw } from 'orm-mw';

    server.use(ormMw(/*IormMwConfig*/));

### Explicit cleanup
Essentially only useful for tests:

    import { tearDownConnections } from 'orm-mw';
    
    tearDownConnections(/*ormsInArgs*/, err => {
        if (err != null) throw err; 
    });

## Configuration

See `IormMwConfig` interface in [orm-mw.d.ts](https://github.com/SamuelMarks/orm-mw).

## Extending

Adding a new ORM? - Expand the `IormMwConfig` interface, and add a new short-function that implements it. See others for reference.

### Development setup
Install the latest Node.JS, `npm i -g typings typescript`, then:

    git clone https://github.com/SamuelMarks/orm-mw
    git clone https://github.com/SamuelMarks/orm-mw-dist
    cd orm-mw
    typings i
    npm i
    npm test

Update [orm-mw-dist](https://github.com/SamuelMarks/orm-mw-dist):

    find -type f -not -name "*.ts" -and -not -path "./.git/*" -and -not -path "./node-modules/*" -and -not -name '*.map' | cpio -pdamv ../orm-mw-dist

Or just a simple:

    cp -r {*.md,*.js*} ../orm-mw-dist

## Future work

  - Add more ORMs and cursors
