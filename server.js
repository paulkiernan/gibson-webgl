#!/usr/bin/env node
// vim: set shiftwidth=2 tabstop=2 softtabstop=2:

/** Redshift Connector Server
 *
 * Basic interface to Redshift for reporting metadata about tables and
 * stuff
 *
 */

// Node requirements and application configuration
var express = require('express'),
    app = express(),
    pg = require('pg'),
    conf = require('rc')('gibson', {}),
    util = require('util'),
    connection_string = util.format(
      "postgres://%s:%s@%s/%s",
      conf.user,
      conf.pass,
      conf.host + ':' + conf.port,
      conf.dbname
    ),
    Q = require('q'),
    hostname = process.env.HOSTNAME || 'localhost',
    port = parseInt(process.env.PORT, 10) || 8080,
    buildDir = process.argv[2] || __dirname + '/dist';

/**
 * Return Promise to connection
 */
function connect() {
  var deferred = Q.defer();

  pg.connect(connection_string, function (error, cli, done) {
    if (error) {
      deferred.reject(new Error("Could not connect to db"));
    } else {
      deferred.resolve(cli);
    }
  });

  return deferred.promise;
}

/**
 * Query to fetch metadata about all tables and their sizes in both
 * megabytes and total number of rows
 * NOTE: unfortunately this query hits some system-level tables in
 *       redshift and therefore requires superuser privs
*/
var GET_CLUSTER_STATS = "SELECT "
                      + "    TRIM(a.name) as Table, "
                      + "    b.mbytes, "
                      + "    a.rows "
                      + "FROM ( "
                      + "    SELECT db_id, id, name, SUM(rows) AS rows "
                      + "    FROM stv_tbl_perm a "
                      + "    GROUP BY db_id, id, name "
                      + ") AS a "
                      + "JOIN pg_class AS pgc ON pgc.oid = a.id "
                      + "JOIN pg_namespace AS pgn ON pgn.oid = pgc.relnamespace "
                      + "JOIN pg_database AS pgdb ON pgdb.oid = a.db_id "
                      + "JOIN ( "
                      + "    SELECT tbl, COUNT(*) AS mbytes "
                      + "    FROM stv_blocklist "
                      + "    GROUP BY tbl "
                      + ") b ON a.id = b.tbl "
                      + "ORDER BY mbytes DESC, a.db_id, a.name;";

/**
 * Wrapper for returning results from SQL
 */
function deferred_query_runner(string_query){

  var deferred = Q.defer();

  connect().then(function (cli) {
    cli.query(string_query, function (err, result) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(result);
      }
    });
  }).catch(function (e) {
    deferred.reject(e);
  });

  return deferred.promise;
}

/**
 * Return a list of all tables and their sizes in our redshift cluster
 */
function tables() {
  return deferred_query_runner(GET_CLUSTER_STATS)
}

// Start registering all urls
app.use('/dist', express.static(buildDir));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/**
 * Serve visualizer
 */
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/dist/index.html');
});

/**
 * Serve list of tables
 */
//app.get('/tables', function (req, res) {
  //tables().then(function (results) {
    //res.send({
        //'data': results.rows,
        //status: 200
    //});
  //}).catch(function (e) {
    //console.log("Encountered exception when trying to fetch tables!");
    //console.log(e);
    //res.json({
        //'data':{},
        //'status': 200,
        //'error': 'Error!!'
    //});
  //});
//});

/**
 * Serve list of tables
 */
app.get('/static/tables', function (req, res) {
  res.sendFile(__dirname + '/data/sanitized_response-2016-02-19.json');
});

console.log(
  "Server exposing %s listening at http://%s:%s",
  buildDir,
  hostname,
  port
);
var server = app.listen(port, hostname);
