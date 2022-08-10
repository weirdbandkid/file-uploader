module.exports = {
    settings: {
        domain: "http://localhost:3000", // No Trailing /
        port: 3000,
        name: ""
    },
    discord: {
        clientID: "", // https://discord.com/developers
        clientSecret: "",// https://discord.com/developers
    },
    access: {
        allowAllGuildMembers: true,
        guildID: "874124347009294396", 
        authorizedUsers: [ // User IDs
        "ID_HERE",
        "ID_HERE"
        ]
    },
    sql: {
        host: 'localhost',
        username: 'root',
        password: '',
        database: 'uploader'
    }
}