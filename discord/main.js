const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const fs = require("fs");

let hardcodedConfig = {};
try {
    if (fs.existsSync("discord/serverconf.json")) {
        hardcodedConfig = JSON.parse(fs.readFileSync("discord/serverconf.json"));
    }
} catch (e) {
    console.warn("Could not read serverconf.json, falling back to environment variables.");
}

const TOKEN = hardcodedConfig.TOKEN || process.env.TOKEN;
const CLIENT_ID = hardcodedConfig.CLIENT_ID || process.env.CLIENT_ID;
const db = new sqlite3.Database('epic_bot.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS servers (
        guild_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        role_id TEXT,
        last_game_end_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

async function getCurrentEpicFreeGame() {
    try {
        const res = await fetch("https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US", {
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Not:A-Brand\";v=\"24\", \"Chromium\";v=\"134\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Linux\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "x-requested-with": "XMLHttpRequest"
            },
            referrer: "https://store.epicgames.com/en-US/",
            referrerPolicy: "no-referrer-when-downgrade",
            method: "GET",
            mode: "cors",
            credentials: "omit"
        });

        const data = await res.json();
        const elements = data.data.Catalog.searchStore.elements;
        const now = new Date();

        const isFreeNow = (element) => {
            const promoBlock = element.promotions?.promotionalOffers;
            if (!promoBlock || promoBlock.length === 0) return false;

            return promoBlock.some(promo =>
                promo.promotionalOffers.some(p => {
                    const start = new Date(p.startDate);
                    const end = new Date(p.endDate);
                    return p.discountSetting?.discountPercentage === 0 &&
                           start <= now && now <= end;
                })
            );
        };

        const freeGame = elements.find(isFreeNow);

        if (freeGame) {
            const promo = freeGame.promotions.promotionalOffers[0].promotionalOffers[0];
            const endDate = new Date(promo.endDate);

            return {
                title: freeGame.title,
                description: freeGame.description,
                paymentURL: `https://store.epicgames.com/purchase?link_generated_by=freegs&highlightColor=338855&lang=en-US&offers=1-${freeGame.namespace}-${freeGame.id}&showNavigation=false#/purchase/payment-methods`,
                endDateUtc: endDate.toISOString(),
                endDatePretty: endDate.toISOString().replace('T', ' ').replace('.000Z', ' UTC'),
                gameLink: (freeGame.productSlug || freeGame.urlSlug) ? `https://store.epicgames.com/en-US/p/${freeGame.productSlug || freeGame.urlSlug}` : null,
                imageUrl: freeGame.keyImages?.find(img => img.type === 'DieselStoreFrontWide')?.url || 
                         freeGame.keyImages?.find(img => img.type === 'OfferImageWide')?.url ||
                         freeGame.keyImages?.[0]?.url
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching Epic Games data:', error);
        return null;
    }
}

function createGameEmbed(gameData) {
    const embed = new EmbedBuilder()
        .setTitle(`${gameData.title}`)
        .setDescription(gameData.description || 'No description available')
        .setColor(0x00B4D8)
        .setTimestamp()
        .setFooter({ text: '[FREEGS](https://github.com/DoxrGitHub/freegs)', iconURL: 'https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHM0OYfiFeMI2p9MWie0CvL99U4GA1gf6_kayTt_kBblFwHwo8BW8JXlqfnYxKPmmBaCZi8ClpwbXOgA6G7dvea_zrF.gU8crDBsE8CEYlpitDvfcjjOeAcKJZ5sLQBUCmB414kSXwCeJ3MpVrNXR.x0-&format=source' })
        .addFields(
            { name: '⏰ Offer Ends', value: `<t:${Math.floor(new Date(gameData.endDateUtc).getTime() / 1000)}:R>`, inline: true },
            { name: '🔗 Links', value: `[Link to EGS](${gameData.gameLink || 'https://store.epicgames.com'}) • [Direct Purchase Link](${gameData.paymentURL})`, inline: true }
        );

    if (gameData.imageUrl) {
        embed.setImage(gameData.imageUrl);
    }

    return embed;
}

function saveServerConfig(guildId, channelId, roleId) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO servers (guild_id, channel_id, role_id) VALUES (?, ?, ?)',
            [guildId, channelId, roleId],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getServerConfig(guildId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM servers WHERE guild_id = ?',
            [guildId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function updateLastGameEndDate(guildId, endDate) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE servers SET last_game_end_date = ? WHERE guild_id = ?',
            [endDate, guildId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function getAllServers() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM servers',
            [],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup FREEGS notifications for this server')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send notifications')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to ping (leave empty for @everyone)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    new SlashCommandBuilder()
        .setName('current-free-game')
        .setDescription('Show the current free Epic Games Store game'),
    
    new SlashCommandBuilder()
        .setName('remove-setup')
        .setDescription('Remove FREEGS notifications from this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, channelId } = interaction;

    try {
        switch (commandName) {
            case 'setup':
                const channel = interaction.options.getChannel('channel');
                const role = interaction.options.getRole('role');
                
                if (!channel.isTextBased()) {
                    interaction.reply({ content: '❌ Please select a text channel!', flags: 64 });                }

                await saveServerConfig(guildId, channel.id, role?.id || '@everyone');
                
                const setupEmbed = new EmbedBuilder()
                    .setTitle('✅ EGS Setup Complete!')
                    .setDescription(`Notifications will be sent to ${channel}`)
                    .addFields(
                        { name: 'Channel', value: `${channel}`, inline: true },
                        { name: 'Role', value: role ? `${role}` : '@everyone', inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.reply({ embeds: [setupEmbed] });

                // immediately send after setup
                const currentGame = await getCurrentEpicFreeGame();
                if (currentGame) {
                    const gameEmbed = createGameEmbed(currentGame);
                    const roleToMention = role ? `<@&${role.id}>` : '@everyone';
                    
                    await channel.send({
                        content: `${roleToMention} **FREEGS: New Epic Games free game available!** FREEGS has crafted a direct purchase link; ensure you're logged into EGS.`,
                        embeds: [gameEmbed]
                    });

                    await updateLastGameEndDate(guildId, currentGame.endDateUtc);
                }
                break;

            case 'current-free-game':
                await interaction.deferReply({ flags: 64 });
                const game = await getCurrentEpicFreeGame();
                if (game) {
                    const embed = createGameEmbed(game);
                    await interaction.editReply({ embeds: [embed], flags: 64 });
                } else {
                    await interaction.editReply({ content: '❌ No free game available right now!', flags: 64 });
                }
                break;

            case 'remove-setup':
                db.run('DELETE FROM servers WHERE guild_id = ?', [guildId], function(err) {
                    if (err) {
                        interaction.reply({ content: '❌ Error removing setup!', flags: 64 });
                    } else if (this.changes === 0) {
                        interaction.reply({ content: '❌ No setup found for this server!', flags: 64 });
                    } else {
                        interaction.reply({ content: '✅ Epic Games notifications removed from this server!', flags: 64 });
                    }
                });
                break;
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        await interaction.reply({ content: '❌ An error occurred while processing your request!', flags: 64 });
    }
});

async function checkForNewGames() {
    try {
        const currentGame = await getCurrentEpicFreeGame();
        if (!currentGame) return;

        const servers = await getAllServers();
        
        for (const server of servers) {
            try {
                const guild = client.guilds.cache.get(server.guild_id);
                if (!guild) continue;

                const channel = guild.channels.cache.get(server.channel_id);
                if (!channel) continue;

                // check if this is a new game by comparing end dates
                if (server.last_game_end_date !== currentGame.endDateUtc) {
                    const gameEmbed = createGameEmbed(currentGame);
                    const roleToMention = server.role_id === '@everyone' ? '@everyone' : `<@&${server.role_id}>`;
                    
                    await channel.send({
                        content: `${roleToMention} **FREEGS: New Epic Games free game available!** FREEGS has crafted a direct purchase link; ensure you're logged into EGS.`,
                        embeds: [gameEmbed]
                    });

                    await updateLastGameEndDate(server.guild_id, currentGame.endDateUtc);
                    console.log(`Sent new game notification to ${guild.name}`);
                }
            } catch (error) {
                console.error(`Error sending notification to server ${server.guild_id}:`, error);
            }
        }
    } catch (error) {
        console.error('Error checking for new games:', error);
    }
}

client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);
    
    await registerCommands();

    console.log("Add FREEGS to your server: https://discord.com/oauth2/authorize?client_id=" + CLIENT_ID)
    
    setInterval(checkForNewGames, 60 * 60 * 1000);
    
    setTimeout(checkForNewGames, 5000); 
});

client.on('guildCreate', guild => {
    console.log(`Added to new server: ${guild.name} (${guild.id})`);
});

client.on('guildDelete', guild => {
    console.log(`Removed from server: ${guild.name} (${guild.id})`);
    db.run('DELETE FROM servers WHERE guild_id = ?', [guild.id]);
});

client.on('error', console.error);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(TOKEN);

console.log("Starting FREEGS; please wait...")