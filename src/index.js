const express = require('express')
const app = express()
const mysql = require('mysql')
const config = require('../config')
const chalk = require('chalk')
const session  = require('express-session')
const passport = require('passport')
const figlet = require('figlet');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const axios = require('axios');
const saltRounds = 10;
require('lodash');
const fileUpload = require('express-fileupload');
const DiscordStrategy = require('passport-discord').Strategy; 
var scopes = ['identify', 'email', 'guilds'];
var prompt = 'consent'
const connection = mysql.createConnection({
    host     : config.sql.host,
    user     : config.sql.username,
    password : config.sql.password,
    database : config.sql.database,
});



module.exports = async () => {


    passport.use(new DiscordStrategy({
        clientID: config.discord.clientID,
        clientSecret: config.discord.clientSecret,
        callbackURL: `${config.settings.domain}/auth/discord`,
        scope: scopes,
        prompt: prompt
    }, function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            return done(null, profile);
        });
    }));
   app.use(bodyParser.json());
    // app.use(cors());
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
    app.use(express.static('public'))

    // app.use(morgan(':id :method :url :response-time'));
    let version;

    async function vers() {
        // let v = await axios.get('https://raw.githubusercontent.com/weirdbandkid/file-uploader/main/package.json')
        let v = await axios({
            method: 'get',
            url: `https://raw.githubusercontent.com/weirdbandkid/file-uploader/main/package.json`,
            });
            let versi = require('../package.json').version
            // console.log(JSON.stringify(v))
        if (v.data.version == versi) {
            version =  `${chalk.green('Up to date!')} You are on the current version (${versi})`
        } else {
            version = `${chalk.red('Your version is out of date.')} Please update to the newer version. Your version - ${versi} | New Version - ${v.data.version}`
        }
    }

    app.listen(config.settings.port, () => {
        // figlet.text('weirdbandkid', { width: 700 }, function(err, data) {
            
        //     console.log(chalk.bold(chalk.blueBright(`-----------------------------------------------------------------------\n`+ data)));
        // });
        figlet.text('File Uploader', { width: 700 }, async function(err, data) {
            if(err) throw err;
            await vers()
            let str = `${data}\n--------------------------------------------------------------`
            console.log(chalk.bold(chalk.blueBright(str)));
            console.log(`${chalk.white('[Express]')} - ${chalk.green('Online')} \n[Site] - ${config.settings.domain}`)
            console.log(`${chalk.white('[Version Checker]')} - ${version}`)

        });
    })

    app.get('/login', passport.authenticate('discord', { scope: scopes, prompt: prompt }), function(req, res) {});
    app.get('/auth/discord',
        passport.authenticate('discord', { failureRedirect: '/' }), function(req, res) { res.redirect('/dashboard') } // auth success
    );
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/',  (req, res) =>  {
        if (req.isAuthenticated()) return res.redirect('/dashboard')
        res.render('login', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!" })
    })

    app.get('/info', checkAuth, function(req, res) {
        res.json(req.user);
    });

    app.get('/upload', checkAuth, function(req, res) {
        res.render('upload', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!" })
    });

    app.post('/upload', checkAuth, async function(req, res) {

        try {
            if(!req.files) {
                res.status(400).send({
                    status: 400,
                    message: 'No file uploaded'
                });
            } else {

                if (!req.body.password){
                    req.body.password = null
                }
                

                let file = req.files.file;
                let key = await keyGenerator();
                let name = `${key}-${file.name}`
                file.mv('./downloads/' + name);
                connection.query(`SELECT * FROM downloads WHERE  user=${req.user.id}`, function(err, sql){
                    let id = sql.length + 1;
                    if (req.body.password !== null) {
                        bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
                            connection.query(`INSERT INTO downloads (id, user, url, amount, name, password) VALUE  ('${id}', '${req.user.id}', '${name}', '0', '${file.name}', '${hash}')`)
                            res.redirect('/dashboard')
                            
                        });
                    } else {
                        connection.query(`INSERT INTO downloads (id, user, url, amount, name) VALUE  ('${id}', '${req.user.id}', '${name}', '0', '${file.name}')`)
                        res.redirect('/dashboard')
                    }


                    
                })
            }
        } catch (err) {
            res.status(500).send(err);
        }
    });


    app.get('/download/:url', async (req, res) => {
        let url = req.params.url
        await connection.query(`SELECT * FROM downloads WHERE  url='${url}'`, function(err, sql){
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
    })

    app.post('/pass/download', async (req, res) => {
        let url = req.body.id
        await connection.query(`SELECT * FROM downloads WHERE  url='${url}'`, function(err, sql){
            if (err) throw err

            if (!sql[0]) {
                res.status(403).send(`<h1>No File Found</h1>`)
            }

            if (sql[0].password) {
                bcrypt.compare(req.body.password, sql[0].password, function(error, response) {
                    // response == true if they match
                    // response == false if password is wrong
                    if (response == false) return res.status(403).send(`<h1>Incorrect Password</h1>`)
                    let num = sql[0].amount + 1;
                    connection.query(`UPDATE downloads SET amount = '${num}' WHERE id=('${sql[0].id}')`)
                    res.download(`./downloads/${url}`, sql[0].name)
                });

                
            }


        })
    })

    app.get('/dashboard', checkAuth, function(req, res) {
        connection.query(`SELECT * FROM downloads WHERE  user=${req.user.id}`, function(err, sql){
            res.render('dash', { brand: config.settings.name, copy: "weirdbandkid", desc: "This is a File Uploader created by weirdbandkid. It is an open source project that is free to use!", sql })
        })
    });

    let characters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '0', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_']

    let keyGenerator = function() {
        let key = "";
        for (let i = 0; i < 10; i++) {
            key += `${characters[Math.floor(Math.random() * characters.length)]}`;
        };
        return key;
    };
    async function checkAuth(req, res, next) {
        if (req.isAuthenticated()){
            let num = 0

        if (config.access.allowAllGuildMembers == true) {
            req.user.guilds.forEach(function(guild){
                if (guild.id == config.access.guildID) {
                    num = num + 1
                    
                }
            })
        }

        config.access.authorizedUsers.forEach(function(user){
                if (req.user.id == user) {
                    num = num + 1 
                }
            })

        if (num == 0){
            // console.log(chalk.red(num))
            res.status(403).send('<h1>You are not authorized to access this page!</h1>');
        } else return next();
        
        
        } else{
            res.redirect('/');
        } 
        


        
    }
    passport.serializeUser(function(user, done) {
        done(null, user);
      });
      
      passport.deserializeUser(function(user, done) {
        done(null, user);
      });

      process.on('unhandledRejection', function(err) { 
        let ignore =[]

        let stillLog = true;
        ignore.forEach(function(e) {
            if(err.toString().includes(e)) {
                stillLog = false;
            }
        })
        if(!stillLog) return;
        console.log(chalk.red(`\nFATAL ERROR: \n\n`, err.stack))
    });
    
}
