'use strict'
const fs = require( 'fs' )
const path = require( 'path' )

function walk( dir ) {
  let results = [ ]
  let list = fs.readdirSync( dir )
  list.forEach( function ( file ) {
    let fullFile = path.join( dir, file )
    let stat = fs.statSync( fullFile )
    if ( stat && stat.isDirectory( ) ) {
      if ( file === 'migrations' )
        results.push( fullFile )
      else
        results = results.concat( walk( fullFile ) )
    }
  } )
  return results
}

let migrationDirs = walk( './modules' )

console.log( 'my db is ' +  process.env.DATABASE_URL )

module.exports = {
  test: {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgres://localhost/speckle2_test',
    migrations: {
      directory: migrationDirs
    },
  },
  development: {
    client: 'pg',
    connection: 'postgres://localhost/speckle2',
    migrations: {
      directory: migrationDirs
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: migrationDirs
    }
  }
}