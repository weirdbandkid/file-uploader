const express = require('express');
const app = express();
const mysql = require('mysql');
const config = require('../config');
const chalk = require('chalk');
const session = require('express-session');
const passport = require('passport');
const figlet = require('figlet');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const saltRounds = 10;
require('lodash');
const fileUpload = require('express-fileupload');
const flash = require('connect-flash');

const connection = mysql.createConnection({
    host: config.sql.host,
    user: config.sql.username,
    password: config.sql.password,
    database: config.sql.database,
});

module.exports = async () => {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(fileUpload());
    app.set('json spaces', 2);
    app.set("view engine", "ejs");
    app.use(session({
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: false
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(express.static('public'));
    app.use(flash());

    app.listen(config.settings.port, () => {
        figlet.text('File Uploader', { width: 700 }, async function (err, data) {
            if (err) throw err;
            console.log(chalk.bold(chalk.blueBright(data)));
            console.log(`${chalk.white('[Express]')} - ${chalk.green('Online')} \n[Site] - ${config.settings.domain}`)
        });
    });

    // Passport Local Strategy for user authentication
    const LocalStrategy = require('passport-local').Strategy;
    passport.use(new LocalStrategy(
        function (username, password, done) {
            connection.query("SELECT * FROM users WHERE username = ?", [username], async (error, results) => {
                if (error) throw error;
                if (results.length === 0) {
                    return done(null, false, { message: 'Incorrect username.' });
                }
                const user = results[0];
                const match = await bcrypt.compare(password, user.password);
                if (!match) {
                    return done(null, false, { message: 'Incorrect password.' });
                }
                return done(null, user);
            });
        }
    ));

    // Serialize and deserialize user
    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        connection.query("SELECT * FROM users WHERE id = ?", [id], (error, results) => {
            if (error) throw error;
            const user = results[0];
            done(error, user);
        });
    });

    // Routes
    app.post('/login', passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/',
        failureFlash: true
    }));

    app.get('/signup', (req, res) => {
        res.render('signup', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!" });
    });
    
    app.post('/signup', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            // Check if username already exists
            const existingUser = await getUserByUsername(username);
            if (existingUser) {
                return res.status(400).send('Username already exists.');
            }
            
            // Hash the password
            const hashedPassword = await bcrypt.hash(password, saltRounds);
    
            // Insert new user into the database
            const newUser = await createUser(username, hashedPassword);
    
            // Redirect to login page or any other page after successful signup
            res.redirect('/');
        } catch (error) {
            console.error('Error during signup:', error);
            res.status(500).send('Internal Server Error');
        }
    });
    app.get('/upload', checkAuth, function(req, res) {
        res.render('upload', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!" })
    });
    app.post('/pass/download', async (req, res) => {
        try {
            let url = req.body.id;
            let sql = await connection.query('SELECT * FROM downloads WHERE url = ?', [url]);
            
            if (!sql[0]) {
                return res.status(403).send('<h1>No File Found</h1>');
            }
    
            if (sql[0].password) {
                bcrypt.compare(req.body.password, sql[0].password, function (error, response) {
                    if (response === false) {
                        return res.status(403).send('<h1>Incorrect Password</h1>');
                    }
    
                    let num = sql[0].amount + 1;
                    connection.query('UPDATE downloads SET amount = ? WHERE id = ?', [num, sql[0].id], (err, result) => {
                        if (err) throw err;
                        res.download(`./downloads/${url}`, sql[0].name);
                    });
                });
            }
        } catch (err) {
            res.status(500).send(err);
        }
    });
    
    const crypto = require('crypto');

app.post('/upload', checkAuth, async function (req, res) {
    try {
        if (!req.files) {
            return res.status(400).send({
                status: 400,
                message: 'No file uploaded'
            });
        }
        
        let file = req.files.file;
        let filename = file.name;
        let ext = filename.split('.').pop(); // Get file extension
        let randomString = crypto.randomBytes(25).toString('hex'); // Generate random string

        let newName = `${randomString}-${filename}`;
        file.mv(`./downloads/${newName}`, async (err) => {
            if (err) {
                return res.status(500).send(err);
            }

            let sql = await connection.query('SELECT * FROM downloads');
            let id = sql.length + 1;
            console.log(sql.length)
            console.log(id);
            let passwordHash = null;
            if (req.body.password) {
                passwordHash = await bcrypt.hash(req.body.password, saltRounds);
            }

            let query = 'INSERT INTO downloads (id, user, url, amount, name';
            let values = [id, req.user.id, newName, 0, filename];
            if (passwordHash) {
                query += ', password)';
                values.push(passwordHash);
            } else {
                query += ')';
            }

            connection.query(query + ' VALUES (?, ?, ?, ?, ?', values, (err, result) => {
                if (err) throw err;
                res.redirect('/dashboard');
            });
        });
    } catch (err) {
        res.status(500).send(err);
    }
});

    

    // Download route
    app.get('/download/:url', async (req, res) => {
        let url = req.params.url
        await connection.query(`SELECT * FROM downloads WHERE  url='${url}'`, function (err, sql) {
            if (err) throw err
            if (!sql[0]) return res.redirect('/dashboard')
            if (sql[0].password) {
                res.render('pass', { id: url, brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!", name: sql[0].name })
            } else {
                let num = sql[0].amount + 1;
                connection.query(`UPDATE downloads SET amount = '${num}' WHERE id=('${sql[0].id}')`)
                res.download(`./downloads/${url}`, sql[0].name)
            }
        })
    });

    let characters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '0', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'];

    let keyGenerator = function () {
        let key = "";
        for (let i = 0; i < 10; i++) {
            key += `${characters[Math.floor(Math.random() * characters.length)]}`;
        };
        return key;
    };

    async function checkAuth(req, res, next) {
        if (req.isAuthenticated()) {
            let num = 0

            if (config.access.allowAllGuildMembers == true) {
                req.user.guilds.forEach(function (guild) {
                    if (guild.id == config.access.guildID) {
                        num = num + 1
                    }
                })
            }

            config.access.authorizedUsers.forEach(function (user) {
                if (req.user.id == user) {
                    num = num + 1
                }
            })

            if (num == 0) {
                res.status(403).send('<h1>You are not authorized to access this page!</h1>');
            } else return next();
        } else {
            res.redirect('/');
        }
    }
    
    async function getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            connection.query("SELECT * FROM users WHERE username = ?", [username], (error, results) => {
                if (error) return reject(error);
                resolve(results[0]);
            });
        });
    }
    
    async function createUser(username, hashedPassword) {
        return new Promise((resolve, reject) => {
            connection.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], (error, results) => {
                if (error) return reject(error);
                resolve(results);
            });
        });
    }
    

    app.get('/', (req, res) => {
        if (req.isAuthenticated()) return res.redirect('/dashboard')
        res.render('login', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!" })
    });

    app.get('/dashboard', checkAuth, function (req, res) {
        connection.query(`SELECT * FROM downloads WHERE  user=${req.user.id}`, function(err, sql){
            res.render('dash', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!", sql })
        })
    });

    // Implement other routes as needed

    // Utility function to check authentication
    function checkAuth(req, res, next) {
        if (req.isAuthenticated()) {
            // User is authenticated
            return next();
        } else {
            // Redirect to login page if not authenticated
            res.redirect('/');
        }
    }
    process.on('unhandledRejection', function (err) {
        let ignore = []

        let stillLog = true;
        ignore.forEach(function (e) {
            if (err.toString().includes(e)) {
                stillLog = false;
            }
        })
        if (!stillLog) return;
        console.log(chalk.red(`\nFATAL ERROR: \n\n`, err.stack))
    });
};
