const { Client, Events, GatewayIntentBits, PermissionsBitField, EmbedBuilder, REST, Routes, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { token, clientId, guildId } = require('./config.json');
const fs = require('fs');

let levels = {};
try { levels = require('./niveaux.json'); } catch (e) { levels = {}; }

let usersEconomy = {};
try {
    const economyData = fs.readFileSync('./économie.json', 'utf8');
    usersEconomy = JSON.parse(economyData);
} catch (err) {
    console.log('Aucune donnée économique trouvée.');
    usersEconomy = {};
}

let economy = {};
try { economy = require('./config_economie.json'); } catch (e) { economy = { daily: 100, monthly: 500 }; }

let roleLevels = {};
try {
    const roleData = fs.readFileSync('./roles.json', 'utf8');
    roleLevels = JSON.parse(roleData);
} catch (err) {
    console.log('Aucune donnée de rôle trouvée.');
    roleLevels = {};
}

let shop = {};
try {
    const shopData = fs.readFileSync('./boutique.json', 'utf8');
    shop = JSON.parse(shopData);
} catch (err) {
    console.log('Aucune donnée de boutique trouvée.');
    shop = {};
}

let giveaways = {};
try {
    const giveawaysData = fs.readFileSync('./concours.json', 'utf8');
    giveaways = JSON.parse(giveawaysData);
} catch (err) {
    console.log('Aucune donnée de giveaway trouvée.');
    giveaways = {};
}

let regulations = {};
try {
    const regulationsData = fs.readFileSync('./reglements.json', 'utf8');
    regulations = JSON.parse(regulationsData);
} catch (err) {
    console.log('Aucune donnée de règlement trouvée.');
    regulations = {};
}

let levelAnnounceChannel = {};
try { levelAnnounceChannel = require('./salonAnnonceNiveau.json'); } catch (e) { levelAnnounceChannel = {}; }

let xpMultipliers = {};
try { xpMultipliers = require('./multiplicateurs_xp.json'); } catch (e) { xpMultipliers = {}; }

let deletedMessages = [];
 
let birthdays = {};
try { birthdays = require('./anniversaires.json'); } catch (e) { birthdays = {}; }


const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ] 
});

function createEmbed(title, description, color = 0x00AE86) {
    return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}

function logInteraction(username, content) {
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const logMessage = `[${timestamp}] ${username}: ${content}\n`;
    fs.appendFileSync('logs.txt', logMessage);
    console.log(logMessage);
}

function saveAllData() {
    fs.writeFileSync('./niveaux.json', JSON.stringify(levels, null, 2));
    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
    fs.writeFileSync('./config_economie.json', JSON.stringify(economy, null, 2));
    fs.writeFileSync('./roles.json', JSON.stringify(roleLevels, null, 2));
    fs.writeFileSync('./boutique.json', JSON.stringify(shop, null, 2));
    fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
    fs.writeFileSync('./reglements.json', JSON.stringify(regulations, null, 2));
    fs.writeFileSync('./salonAnnonceNiveau.json', JSON.stringify(levelAnnounceChannel, null, 2));
    fs.writeFileSync('./multiplicateurs_xp.json', JSON.stringify(xpMultipliers, null, 2));
    fs.writeFileSync('./anniversaires.json', JSON.stringify(birthdays, null, 2));
}

function parseDateString(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length < 2) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2] ? parseInt(parts[2], 10) : null;
    if (Number.isNaN(day) || Number.isNaN(month)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return { day, month, year };
}

function formatDateObj(d) {
    if (!d) return 'Inconnu';
    return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}${d.year ? '/' + d.year : ''}`;
}

async function checkBirthdaysAndAnnounce() {
    try {
        const now = new Date();
        const todayDay = now.getDate();
        const todayMonth = now.getMonth() + 1;
        for (const [gid, gdata] of Object.entries(birthdays)) {
            if (!gdata || !gdata.users) continue;
            const guild = client.guilds.cache.get(gid);
            if (!guild) continue;
            const announceChannelId = gdata.announceChannel;
            if (!announceChannelId) continue;
            const channel = guild.channels.cache.get(announceChannelId);
            if (!channel || !channel.isTextBased()) continue;
            const birthdayUsers = Object.entries(gdata.users).filter(([, dateObj]) => {
                return dateObj && dateObj.day === todayDay && dateObj.month === todayMonth;
            });
            if (birthdayUsers.length === 0) continue;
            let mentions = '';
            for (const [uid] of birthdayUsers) {
                mentions += `<@${uid}> `;
            }
            await channel.send({ embeds: [createEmbed('Joyeux anniversaire 🎉', `${mentions}\nBon anniversaire ! 🎂`)] });
        }
    } catch (err) {
        console.error('Erreur checkBirthdaysAndAnnounce:', err);
    }
}

function getRandomWinners(participants, count) {
    const shuffled = participants.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(userId => `<@${userId}>`);
}

function addXP(userID, xpToAdd, guildId, member = null) {
    
    let multiplier = 1;
    if (member) {
        for (const role of member.roles.cache.values()) {
            if (xpMultipliers[role.id]) {
                multiplier = Math.max(multiplier, xpMultipliers[role.id]);
            }
        }
    }
    xpToAdd *= multiplier;

    if (!levels[userID]) levels[userID] = { xp: 0, level: 1 };
    levels[userID].xp += xpToAdd;
    let xpNeeded = levels[userID].level * 100;
    if (levels[userID].xp >= xpNeeded) {
        levels[userID].level++;
        levels[userID].xp = 0;
        
        let announceChannel = null;
        if (levelAnnounceChannel[guildId]) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) announceChannel = guild.channels.cache.get(levelAnnounceChannel[guildId]);
        }
        if (announceChannel) {
            announceChannel.send({ embeds: [createEmbed('Niveau Supérieur!', `<@${userID}> est maintenant niveau ${levels[userID].level}!`)] });
        }
    }
    fs.writeFileSync('./niveaux.json', JSON.stringify(levels, null, 2));
}

function getLeaderboard() {
    let leaderboard = Object.entries(levels).map(([id, data]) => ({ id, ...data }));
    leaderboard.sort((a, b) => (b.level === a.level) ? b.xp - a.xp : b.level - a.level);
    return leaderboard.slice(0, 10);
}

async function finishGiveaway(messageId) {
    if (!giveaways[messageId]) return;
    
    const giveaway = giveaways[messageId];
    if (giveaway.role) return; 
    
    const winnerList = giveaway.participants.length > 0 
        ? getRandomWinners(giveaway.participants, giveaway.winnersCount) 
        : ['Aucun gagnant !'];
    
    try {
        const allGuilds = client.guilds.cache;
        for (const guild of allGuilds.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (!channel.isTextBased()) continue;
                try {
                    const msg = await channel.messages.fetch(messageId).catch(() => null);
                    if (msg) {
                        await channel.send({
                            embeds: [createEmbed('Concours Terminé', `🎉 **Concours terminé !** 🎉\n\nObjet à gagner : ${giveaway.prize}\nGagnants : ${winnerList.join(', ')}`)]
                        });
                        fs.writeFileSync('giveaway-enter.txt', giveaway.participants.join('\n'));
                        delete giveaways[messageId];
                        fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
                        return;
                    }
                } catch (e) { }
            }
        }
    } catch (err) {
        console.error('Erreur finishGiveaway:', err);
    }
    
    delete giveaways[messageId];
    fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
}

const commands = [
    { name: 'help', description: 'Affiche l\'aide et la liste des commandes.' },
    { name: 'latence', description: 'Affiche la latence du bot.' },
    { name: 'espionner', description: 'Affiche le dernier message supprimé (admins seulement).' },
    {
        name: 'envoyer-embed',
        description: 'Envoie un message dans un embed personnalisé.',
        options: [
            { type: 3, name: 'titre', description: 'Le titre de l\'embed.', required: true },
            { type: 3, name: 'message', description: 'Le message à envoyer dans l\'embed. Utilisez \\n pour les retours à la ligne.', required: true }
        ]
    },
    {
        name: 'bannir',
        description: 'Bannit un utilisateur.',
        options: [
            { type: 6, name: 'utilisateur', description: 'L\'utilisateur à bannir.', required: true },
            { type: 3, name: 'raison', description: 'La raison du bannissement.', required: false }
        ]
    },
    {
        name: 'muter',
        description: 'Mute un utilisateur.',
        options: [
            { type: 6, name: 'utilisateur', description: 'L\'utilisateur à mute.', required: true },
            { type: 4, name: 'duree', description: 'Durée en minutes.', required: true },
            { type: 3, name: 'raison', description: 'La raison du mute.', required: false }
        ]
    },
    { name: 'demuter', description: 'Unmute un utilisateur.', options: [{ type: 6, name: 'utilisateur', description: 'L\'utilisateur à unmute.', required: true }] },
    { name: 'niveau', description: 'Affiche votre niveau.' },
    { name: 'classement', description: 'Affiche le classement des niveaux.' },
    { name: 'envoyer-message', description: 'Envoie un message sous le nom du bot.', options: [{ type: 3, name: 'message', description: 'Le message à envoyer.', required: true }] },
    { name: 'salon-nettoyer', description: 'Supprime tous les messages dans le salon actuel.' },
    {
        name: 'config-economie',
        description: 'Configure les montants de l\'économie.',
        options: [
            { type: 4, name: 'quotidien', description: 'Montant de la récompense quotidienne.', required: true },
            { type: 4, name: 'mensuel', description: 'Montant de la récompense mensuelle.', required: true }
        ]
    },
    { name: 'quotidien', description: 'Réclamez votre récompense quotidienne.' },
    { name: 'mensuel', description: 'Réclamez votre récompense mensuelle.' },
    {
        name: 'role-niveau',
        description: 'Définit un rôle pour un niveau spécifique.',
        options: [
            { type: 4, name: 'niveau', description: 'Niveau pour lequel définir le rôle.', required: true },
            { type: 8, name: 'role', description: 'Rôle à attribuer.', required: true }
        ]
    },
    {
        name: 'concours',
        description: 'Créez un concours.',
        options: [
            { type: 3, name: 'prix', description: 'Objet à gagner.', required: true },
            { type: 4, name: 'gagnants', description: 'Nombre de gagnants.', required: true },
            { type: 4, name: 'duree', description: 'Durée en minutes.', required: true }
        ]
    },
    {
        name: 'reglement',
        description: 'Créez un règlement pour le serveur.',
        options: [
            { type: 3, name: 'contenu', description: 'Le contenu du règlement. Utilisez \\n pour les retours à la ligne.', required: true },
            { type: 8, name: 'role', description: 'Le rôle à attribuer aux utilisateurs qui réagissent.', required: true }
        ]
    },
    {
        name: 'config-boutique',
        description: 'Ajoute un article en boutique (Admin uniquement).',
        options: [
            { type: 8, name: 'role', description: 'Rôle à vendre', required: true },
            { type: 4, name: 'prix', description: 'Prix en pièces', required: true },
            { type: 3, name: 'nom', description: 'Nom affiché (optionnel)', required: false }
        ]
    },
    { name: 'boutique', description: 'Affiche la boutique du serveur.' },
    { name: 'acheter', description: 'Achetez un article par son index.', options: [{ type: 4, name: 'index', description: 'Index de l\'article (voir /boutique)', required: true }] },
    {
        name: 'ajouter-argent',
        description: 'Ajouter de l\'argent à un utilisateur (Admin uniquement).',
        options: [
            { type: 6, name: 'utilisateur', description: 'Utilisateur cible.', required: true },
            { type: 4, name: 'montant', description: 'Montant à ajouter.', required: true }
        ]
    },
    {
        name: 'retirer-argent',
        description: 'Retirer de l\'argent à un utilisateur (Admin uniquement).',
        options: [
            { type: 6, name: 'utilisateur', description: 'Utilisateur cible.', required: true },
            { type: 4, name: 'montant', description: 'Montant à retirer.', required: true }
        ]
    },
    {
        name: 'ajouter-xp',
        description: 'Ajouter de l\'XP à un utilisateur (Admin uniquement).',
        options: [
            { type: 6, name: 'utilisateur', description: 'Utilisateur cible.', required: true },
            { type: 4, name: 'montant', description: 'XP à ajouter.', required: true }
        ]
    },
    {
        name: 'retirer-xp',
        description: 'Retirer de l\'XP à un utilisateur (Admin uniquement).',
        options: [
            { type: 6, name: 'utilisateur', description: 'Utilisateur cible.', required: true },
            { type: 4, name: 'montant', description: 'XP à retirer.', required: true }
        ]
    },
    {
        name: 'definir-niveau',
        description: 'Définir le niveau d\'un utilisateur (Admin uniquement).',
        options: [
            { type: 6, name: 'utilisateur', description: 'Utilisateur cible.', required: true },
            { type: 4, name: 'niveau', description: 'Niveau à définir.', required: true }
        ]
    },
    {
        name: 'ajouter-argent-global',
        description: 'Ajouter de l\'argent à tous les utilisateurs (Admin uniquement).',
        options: [
            { type: 4, name: 'montant', description: 'Montant à ajouter à chacun.', required: true }
        ]
    },
    {
        name: 'ajouter-xp-global',
        description: 'Ajouter de l\'XP à tous les utilisateurs (Admin uniquement).',
        options: [
            { type: 4, name: 'montant', description: 'XP à ajouter à chacun.', required: true }
        ]
    },
    {
        name: 'retirer-argent-global',
        description: 'Retirer de l\'argent à tous les utilisateurs (Admin uniquement).',
        options: [
            { type: 4, name: 'montant', description: 'Montant à retirer à chacun.', required: true }
        ]
    },
    {
        name: 'anniversaire-set',
        description: 'Définit l\'anniversaire d\'un utilisateur (format DD/MM ou DD/MM/YYYY).',
        options: [
            { type: 6, name: 'utilisateur', description: 'Utilisateur (optionnel).', required: false },
            { type: 3, name: 'date', description: 'Date (DD/MM ou DD/MM/YYYY).', required: true }
        ]
    },
    {
        name: 'anniversaire-remove',
        description: 'Supprime l\'anniversaire d\'un utilisateur.',
        options: [ { type: 6, name: 'utilisateur', description: 'Utilisateur (optionnel).', required: false } ]
    },
    {
        name: 'anniversaire-prochain',
        description: 'Affiche les prochains anniversaires du serveur.'
    },
    {
        name: 'config-anniv-salon',
        description: 'Définit le salon d\'annonces d\'anniversaire (Admin uniquement).',
        options: [ { type: 7, name: 'salon', description: 'Salon pour annonces.', required: true } ]
    },
    {
        name: 'retirer-xp-global',
        description: 'Retirer de l\'XP à tous les utilisateurs (Admin uniquement).',
        options: [
            { type: 4, name: 'montant', description: 'XP à retirer à chacun.', required: true }
        ]
    },
    {
        name: 'definir-salon-niveau',
        description: 'Définir le salon pour les annonces de passage de niveau (Admin uniquement).',
        options: [
            { type: 7, name: 'salon', description: 'Salon pour les annonces.', required: true }
        ]
    },
    {
        name: 'definir-multiplicateur-xp',
        description: 'Définir le multiplicateur d\'XP pour un rôle (Admin uniquement).',
        options: [
            { type: 8, name: 'role', description: 'Rôle concerné.', required: true },
            { type: 10, name: 'multiplicateur', description: 'Multiplicateur (ex: 1.5 pour 50% de bonus).', required: true }
        ]
    },
    {
        name: 'ticket-creer',
        description: 'Créer un ticket pour les demandes d\'assistance.'
    }
];


const rest = new REST({ version: '9' }).setToken(token);
(async () => {
    try {
        console.log('Enregistrement des commandes slash...');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Commandes slash enregistrées.');
    } catch (error) {
        console.error('Erreur enregistrement commandes:', error);
    }
})();

client.once(Events.ClientReady, readyClient => {
    console.log(`Prêt ! ${readyClient.user.tag} est en service !`);
    
    
    Object.entries(giveaways).forEach(([msgId, giveaway]) => {
        if (giveaway.endTime && !giveaway.role) {
            const timeLeft = giveaway.endTime - Date.now();
            if (timeLeft > 0) {
                console.log(`Reconnecter giveaway ${msgId}, temps restant: ${timeLeft}ms`);
                setTimeout(() => finishGiveaway(msgId), timeLeft);
            }
        }
    });
    
    checkBirthdaysAndAnnounce();
    
    setInterval(() => checkBirthdaysAndAnnounce(), 1000 * 60 * 60);
});

client.on(Events.MessageCreate, message => {
    if (message.author.bot) return;
    addXP(message.author.id, 15, message.guild.id, message.member);
});

client.on(Events.MessageDelete, message => {
    if (message.partial) return;
    deletedMessages.unshift(message);
    if (deletedMessages.length > 10) deletedMessages.pop();
    if (message.author) logInteraction(message.author.tag, `Message supprimé: ${message.content}`);
});


client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName, options } = interaction;

    try {
        switch (commandName) {
            case 'help': {
                const helpEmbed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle('📚 AIDE — Commandes du bot')
                    .setDescription('Voici toutes les commandes disponibles :')
                    .addFields(
                        { name: '🔧 MODÉRATION', value: '`/bannir` `/muter` `/demuter` `/salon-nettoyer` `/definir-salon-niveau`', inline: false },
                        { name: '🎂 ANNIVERSAIRES', value: '`/anniversaire-set` `/anniversaire-remove` `/anniversaire-prochain` `/config-anniv-salon`', inline: false },
                        { name: '💰 ÉCONOMIE', value: '`/quotidien` `/mensuel` `/ajouter-argent` `/retirer-argent` `/boutique` `/acheter` `/config-economie`', inline: false },
                        { name: '🏆 NIVEAUX & XP', value: '`/niveau` `/classement` `/ajouter-xp` `/retirer-xp` `/definir-niveau` `/definir-multiplicateur-xp` `/ajouter-xp-global` `/retirer-xp-global`', inline: false },
                        { name: '🎁 CONCOURS', value: '`/concours`', inline: false },
                        { name: '🛒 BOUTIQUE', value: '`/config-boutique` `/boutique` `/acheter`', inline: false },
                        { name: '📨 AUTRES', value: '`/envoyer-embed` `/envoyer-message` `/ticket-creer` `/espionner` `/latence`', inline: false }
                    )
                    .setFooter({ text: 'Utilisez /commande --help pour plus de détails' })
                    .setTimestamp();

                await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
                break;
            }

            case 'latence': {
                const sentMessage = await interaction.reply({ embeds: [createEmbed('Ping', 'Calcul...')], fetchReply: true });
                const ping = sentMessage.createdTimestamp - interaction.createdTimestamp;
                await interaction.editReply({ embeds: [createEmbed('Ping', `🏓 ${ping} ms`)] });
                break;
            }

            case 'espionner': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                if (deletedMessages.length === 0) {
                    await interaction.reply({ embeds: [createEmbed('Aucun message', 'Aucun message supprimé trouvé.')], ephemeral: true });
                } else {
                    const lastDeleted = deletedMessages[deletedMessages.length - 1];
                    await interaction.reply({ embeds: [createEmbed('Dernier message supprimé', `**Auteur:** ${lastDeleted.author.tag}\n**Contenu:** ${lastDeleted.content}`)], ephemeral: true });
                }
                break;
            }

            case 'salon-nettoyer': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Permission ManageMessages requise.', 0xff0000)], ephemeral: true });
                    return;
                }
                const channel = interaction.channel;
                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                await channel.bulkDelete(fetchedMessages, true).catch(err => console.error('bulkDelete error:', err));
                await interaction.reply({ embeds: [createEmbed('Succès', 'Messages supprimés.')] });
                break;
            }

            case 'envoyer-embed': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                await interaction.deferReply({ ephemeral: true });
                const title = options.getString('titre');
                const msg = options.getString('message').replace(/\\n/g, '\n');
                await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(msg).setColor(0x00AE86).setTimestamp()] });
                await interaction.editReply({ embeds: [createEmbed('Succès', 'Embed envoyé.')] });
                break;
            }

            case 'bannir': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const reason = options.getString('raison') || 'Aucune raison';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (member) {
                    await member.ban({ reason });
                    await interaction.reply({ embeds: [createEmbed('Ban', `${user.tag} banni : ${reason}`)] });
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur introuvable.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'muter': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const duration = options.getInteger('duree');
                const reason = options.getString('raison') || 'Aucune raison';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (!member) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur introuvable.', 0xff0000)], ephemeral: true });
                    return;
                }
                const muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');
                if (!muteRole) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Rôle Muted manquant.', 0xff0000)], ephemeral: true });
                    return;
                }
                await member.roles.add(muteRole, reason);
                await interaction.reply({ embeds: [createEmbed('Mute', `${user.tag} mute : ${reason}`)] });
                setTimeout(async () => {
                    try {
                        const refreshed = await interaction.guild.members.fetch(user.id);
                        if (refreshed.roles.cache.has(muteRole.id)) {
                            await refreshed.roles.remove(muteRole, 'Mute terminé');
                        }
                    } catch (err) { console.error('unmute error:', err); }
                }, duration * 60 * 1000);
                break;
            }

            case 'demuter': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (!member) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur introuvable.', 0xff0000)], ephemeral: true });
                    return;
                }
                const muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');
                if (!muteRole) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Rôle Muted manquant.', 0xff0000)], ephemeral: true });
                    return;
                }
                if (member.roles.cache.has(muteRole.id)) {
                    await member.roles.remove(muteRole);
                    await interaction.reply({ embeds: [createEmbed('Unmute', `${user.tag} unmute.`)] });
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', `${user.tag} n'est pas mute.`, 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'niveau': {
                await interaction.deferReply();
                const uid = interaction.user.id;
                if (!levels[uid]) levels[uid] = { xp: 0, level: 1 };
                const xpNeeded = levels[uid].level * 100;
                const embed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle(`Niveau ${interaction.user.username}`)
                    .setDescription(`📊 Niveau: ${levels[uid].level}\n✨ XP: ${levels[uid].xp}/${xpNeeded}\n🎯 Reste: ${xpNeeded - levels[uid].xp} XP`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'classement': {
                const lb = getLeaderboard();
                let txt = '';
                lb.forEach((u, i) => { txt += `${i + 1}. <@${u.id}> — Lvl ${u.level} (${u.xp} XP)\n`; });
                await interaction.reply({ embeds: [createEmbed('Leaderboard', txt || 'Aucun')] });
                break;
            }

            case 'envoyer-message': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const msg = options.getString('message');
                await interaction.channel.send(msg);
                await interaction.reply({ embeds: [createEmbed('Succès', 'Message envoyé.')] , ephemeral: true });
                break;
            }

            case 'config-economie': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                economy.daily = options.getInteger('quotidien');
                economy.monthly = options.getInteger('mensuel');
                fs.writeFileSync('./config_economie.json', JSON.stringify(economy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Config Économie', `Daily: ${economy.daily}\nMonthly: ${economy.monthly}`)] });
                break;
            }

            case 'quotidien': {
                const uid = interaction.user.id;
                if (!usersEconomy[uid]) usersEconomy[uid] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                const lastDailyDate = new Date(usersEconomy[uid].lastDaily);
                const now = new Date();
                if (lastDailyDate.toDateString() === now.toDateString()) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Déjà réclamé aujourd\'hui.', 0xff0000)], ephemeral: true });
                } else {
                    usersEconomy[uid].lastDaily = now.getTime();
                    usersEconomy[uid].balance += economy.daily;
                    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                    await interaction.reply({ embeds: [createEmbed('Succès', `+${economy.daily} pièces!`)] });
                }
                break;
            }

            case 'mensuel': {
                const uid = interaction.user.id;
                if (!usersEconomy[uid]) usersEconomy[uid] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                const lastMonthlyDate = new Date(usersEconomy[uid].lastMonthly);
                const now = new Date();
                if (lastMonthlyDate.getMonth() === now.getMonth() && lastMonthlyDate.getFullYear() === now.getFullYear()) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Déjà réclamé ce mois.', 0xff0000)], ephemeral: true });
                } else {
                    usersEconomy[uid].lastMonthly = now.getTime();
                    usersEconomy[uid].balance += economy.monthly;
                    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                    await interaction.reply({ embeds: [createEmbed('Succès', `+${economy.monthly} pièces!`)] });
                }
                break;
            }

            case 'role-niveau': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const lvl = options.getInteger('niveau');
                const role = options.getRole('role');
                roleLevels[lvl] = role.id;
                fs.writeFileSync('./roles.json', JSON.stringify(roleLevels, null, 2));
                await interaction.reply({ embeds: [createEmbed('Rôle Défini', `Lvl ${lvl} → <@&${role.id}>`)] });
                break;
            }

            case 'concours': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const prize = options.getString('prix');
                const winnersCount = options.getInteger('gagnants');
                const duration = options.getInteger('duree') * 60000;
                const msg = await interaction.reply({
                    embeds: [createEmbed('Concours', `🎉 **Concours !** 🎉\n\nPrix: ${prize}\nGagnants: ${winnersCount}\nDurée: ${options.getInteger('duree')}min\n\nRéagissez 🎉 pour participer!`)],
                    fetchReply: true
                });
                await msg.react('🎉');
                giveaways[msg.id] = { prize, winnersCount, participants: [], endTime: Date.now() + duration, guildId: interaction.guild.id, channelId: interaction.channel.id };
                fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
                setTimeout(() => finishGiveaway(msg.id), duration);
                break;
            }

            case 'reglement': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                await interaction.deferReply();
                const content = options.getString('contenu').replace(/\\n/g, '\n');
                const role = options.getRole('role');
                const ruleEmbed = new EmbedBuilder().setColor(0x00AE86).setTitle('Règlement').setDescription(content).setFooter({ text: 'Réagissez ✅ pour accepter' }).setTimestamp();
                const msg = await interaction.channel.send({ embeds: [ruleEmbed] });
                await msg.react('✅');
                giveaways[msg.id] = { role: { id: role.id, name: role.name }, guildId: interaction.guild.id };
                regulations[msg.id] = { roleId: role.id, guildId: interaction.guild.id };
                fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
                fs.writeFileSync('./reglements.json', JSON.stringify(regulations, null, 2));
                await interaction.editReply({ embeds: [createEmbed('Succès', 'Règlement envoyé.')] });
                break;
            }

            case 'config-boutique': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const role = options.getRole('role');
                const price = options.getInteger('prix');
                const name = options.getString('nom') || role.name;
                const gid = interaction.guild.id;
                if (!shop[gid]) shop[gid] = [];
                shop[gid].push({ id: role.id, name, price });
                fs.writeFileSync('./boutique.json', JSON.stringify(shop, null, 2));
                await interaction.reply({ embeds: [createEmbed('Boutique', `Article ajouté: **${name}** (${price} pièces)`)] });
                break;
            }

            case 'boutique': {
                const gid = interaction.guild.id;
                const items = shop[gid] || [];
                if (items.length === 0) {
                    await interaction.reply({ embeds: [createEmbed('Boutique', 'Vide.')] });
                    return;
                }
                const embed = new EmbedBuilder().setTitle('Boutique').setColor(0x00AE86);
                let desc = '';
                items.forEach((it, idx) => { desc += `**${idx + 1}. ${it.name}**\n<@&${it.id}> — ${it.price} 💰\n\n`; });
                embed.setDescription(desc).setFooter({ text: 'Achetez: /acheter <index>' });
                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'acheter': {
                const idx = options.getInteger('index');
                const gid = interaction.guild.id;
                const items = shop[gid] || [];
                if (!idx || idx < 1 || idx > items.length) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Index invalide.', 0xff0000)], ephemeral: true });
                    return;
                }
                const item = items[idx - 1];
                const uid = interaction.user.id;
                if (!usersEconomy[uid]) usersEconomy[uid] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                if (usersEconomy[uid].balance < item.price) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Fonds insuffisants.', 0xff0000)], ephemeral: true });
                    return;
                }
                usersEconomy[uid].balance -= item.price;
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                try {
                    const member = await interaction.guild.members.fetch(uid);
                    const roleObj = await interaction.guild.roles.fetch(item.id);
                    if (member && roleObj) {
                        await member.roles.add(roleObj, 'Achat');
                        await interaction.reply({ embeds: [createEmbed('Succès', `Acheté: **${item.name}** pour ${item.price} 💰`)] });
                    } else {
                        await interaction.reply({ embeds: [createEmbed('Achat', 'Débité mais rôle/membre intro. Vous avez été débité.')] , ephemeral: true });
                    }
                } catch (err) {
                    console.error('Achat error:', err);
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Erreur achat.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'ajouter-argent': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Montant positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                if (!usersEconomy[user.id]) usersEconomy[user.id] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                usersEconomy[user.id].balance += amount;
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `+${amount} pièces à <@${user.id}>`)] });
                break;
            }

            case 'retirer-argent': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Montant positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                if (!usersEconomy[user.id]) usersEconomy[user.id] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                if (usersEconomy[user.id].balance < amount) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Solde insuffisant.', 0xff0000)], ephemeral: true });
                    return;
                }
                usersEconomy[user.id].balance -= amount;
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `-${amount} pièces à <@${user.id}>`)] });
                break;
            }

            case 'ajouter-xp': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'XP positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                addXP(user.id, amount, interaction.guild.id, member);
                await interaction.reply({ embeds: [createEmbed('Succès', `+${amount} XP à <@${user.id}>`)] });
                break;
            }

            case 'retirer-xp': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'XP positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                if (!levels[user.id]) levels[user.id] = { xp: 0, level: 1 };
                if (levels[user.id].xp < amount) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'XP insuffisant.', 0xff0000)], ephemeral: true });
                    return;
                }
                levels[user.id].xp -= amount;
                
                while (levels[user.id].level > 1 && levels[user.id].xp < (levels[user.id].level - 1) * 100) {
                    levels[user.id].level--;
                }
                fs.writeFileSync('./niveaux.json', JSON.stringify(levels, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `-${amount} XP à <@${user.id}>`)] });
                break;
            }

            case 'definir-niveau': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('utilisateur');
                const newLevel = options.getInteger('niveau');
                if (newLevel < 1) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Niveau minimum 1.', 0xff0000)], ephemeral: true });
                    return;
                }
                if (!levels[user.id]) levels[user.id] = { xp: 0, level: 1 };
                levels[user.id].level = newLevel;
                levels[user.id].xp = newLevel * 100; 
                fs.writeFileSync('./niveaux.json', JSON.stringify(levels, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `Niveau de <@${user.id}> défini à ${newLevel}`)] });
                break;
            }

            case 'ajouter-argent-global': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Montant positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const members = await interaction.guild.members.fetch();
                let count = 0;
                for (const member of members.values()) {
                    if (!member.user.bot) {
                        if (!usersEconomy[member.id]) usersEconomy[member.id] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                        usersEconomy[member.id].balance += amount;
                        count++;
                    }
                }
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `+${amount} pièces ajoutées à ${count} utilisateurs.`)] });
                break;
            }

            case 'ajouter-xp-global': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'XP positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const members = await interaction.guild.members.fetch();
                let count = 0;
                for (const member of members.values()) {
                    if (!member.user.bot) {
                        addXP(member.id, amount, interaction.guild.id, member);
                        count++;
                    }
                }
                await interaction.reply({ embeds: [createEmbed('Succès', `+${amount} XP ajoutés à ${count} utilisateurs.`)] });
                break;
            }

            case 'retirer-argent-global': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Montant positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const members = await interaction.guild.members.fetch();
                let count = 0;
                for (const member of members.values()) {
                    if (!member.user.bot) {
                        if (!usersEconomy[member.id]) usersEconomy[member.id] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                        if (usersEconomy[member.id].balance >= amount) {
                            usersEconomy[member.id].balance -= amount;
                            count++;
                        }
                    }
                }
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `-${amount} pièces retirées à ${count} utilisateurs.`)] });
                break;
            }

            case 'retirer-xp-global': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const amount = options.getInteger('montant');
                if (amount <= 0) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'XP positif requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const members = await interaction.guild.members.fetch();
                let count = 0;
                for (const member of members.values()) {
                    if (!member.user.bot) {
                        if (!levels[member.id]) levels[member.id] = { xp: 0, level: 1 };
                        if (levels[member.id].xp >= amount) {
                            levels[member.id].xp -= amount;
                            while (levels[member.id].level > 1 && levels[member.id].xp < (levels[member.id].level - 1) * 100) {
                                levels[member.id].level--;
                            }
                            count++;
                        }
                    }
                }
                fs.writeFileSync('./niveaux.json', JSON.stringify(levels, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `-${amount} XP retirés à ${count} utilisateurs.`)] });
                break;
            }

            case 'definir-salon-niveau': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const channel = options.getChannel('salon');
                if (!channel.isTextBased()) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Salon texte requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                levelAnnounceChannel[interaction.guild.id] = channel.id;
                fs.writeFileSync('./salonAnnonceNiveau.json', JSON.stringify(levelAnnounceChannel, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `Salon d'annonces défini à ${channel}.`)] });
                break;
            }

            case 'definir-multiplicateur-xp': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const role = options.getRole('role');
                const multiplier = options.getNumber('multiplicateur');
                if (multiplier < 1) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Multiplicateur minimum 1.', 0xff0000)], ephemeral: true });
                    return;
                }
                xpMultipliers[role.id] = multiplier;
                fs.writeFileSync('./multiplicateurs_xp.json', JSON.stringify(xpMultipliers, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `Multiplicateur d'XP pour ${role.name} défini à ${multiplier}x.`)] });
                break;
            }

            case 'anniversaire-set': {
                const target = options.getUser('utilisateur') || interaction.user;
                const dateStr = options.getString('date');
                const parsed = parseDateString(dateStr);
                if (!parsed) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Format de date invalide. Utilisez DD/MM ou DD/MM/YYYY.', 0xff0000)], ephemeral: true });
                    return;
                }
                const gid = interaction.guild.id;
                if (!birthdays[gid]) birthdays[gid] = { users: {}, announceChannel: birthdays[gid] ? birthdays[gid].announceChannel : undefined };
                birthdays[gid].users[target.id] = parsed;
                fs.writeFileSync('./anniversaires.json', JSON.stringify(birthdays, null, 2));
                await interaction.reply({ embeds: [createEmbed('Anniversaire défini', `${target.tag || target.username} → ${formatDateObj(parsed)}`)] });
                break;
            }

            case 'anniversaire-remove': {
                const target = options.getUser('utilisateur') || interaction.user;
                const gid = interaction.guild.id;
                if (!birthdays[gid] || !birthdays[gid].users || !birthdays[gid].users[target.id]) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Aucun anniversaire trouvé pour cet utilisateur.', 0xff0000)], ephemeral: true });
                    return;
                }
                delete birthdays[gid].users[target.id];
                fs.writeFileSync('./anniversaires.json', JSON.stringify(birthdays, null, 2));
                await interaction.reply({ embeds: [createEmbed('Anniversaire supprimé', `Anniversaire de ${target.tag || target.username} supprimé.`)] });
                break;
            }

            case 'anniversaire-prochain': {
                const gid = interaction.guild.id;
                if (!birthdays[gid] || !birthdays[gid].users) {
                    await interaction.reply({ embeds: [createEmbed('Aucun anniversaire', 'Aucun anniversaire enregistré pour ce serveur.')], ephemeral: true });
                    return;
                }
                const now = new Date();
                const currentYear = now.getFullYear();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const list = [];
                for (const [uid, d] of Object.entries(birthdays[gid].users)) {
                    if (!d) continue;
                    let next = new Date(currentYear, d.month - 1, d.day);
                    if (next < today) next = new Date(currentYear + 1, d.month - 1, d.day);
                    list.push({ uid, next, dateObj: d });
                }
                list.sort((a, b) => a.next - b.next);
                const top = list.slice(0, 10);
                let txt = '';
                top.forEach((it, i) => { txt += `${i + 1}. <@${it.uid}> — ${formatDateObj(it.dateObj)} (${it.next.toLocaleDateString('fr-FR')})\n`; });
                await interaction.reply({ embeds: [createEmbed('Prochains anniversaires', txt || 'Aucun')] });
                break;
            }

            case 'config-anniv-salon': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const channel = options.getChannel('salon');
                if (!channel.isTextBased()) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Salon texte requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const gid = interaction.guild.id;
                if (!birthdays[gid]) birthdays[gid] = { users: {}, announceChannel: channel.id };
                else birthdays[gid].announceChannel = channel.id;
                fs.writeFileSync('./anniversaires.json', JSON.stringify(birthdays, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `Salon d'anniversaire défini à ${channel}.`)] });
                break;
            }

            case 'ticket-creer': {
                const hasAdminRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

                if (!hasAdminRole) {
                    return interaction.reply({ 
                        content: 'Vous devez être un administrateur pour créer un ticket.', 
                        ephemeral: true 
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle('Système de Ticket')
                    .setDescription('Cliquez sur le bouton ci-dessous pour ouvrir un ticket.');

                const button = new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Ouvrir un Ticket')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder()
                    .addComponents(button);

                await interaction.reply({ 
                    embeds: [embed], 
                    components: [row] 
                });
                break;
            }

            default:
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Commande inconnue.')], ephemeral: true });
        }
    } catch (err) {
        console.error('Interaction error:', err);
        if (!interaction.replied) await interaction.reply({ embeds: [createEmbed('Erreur', 'Une erreur est survenue.', 0xff0000)], ephemeral: true });
    }
});


client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) {
        try { await reaction.fetch(); } catch (error) { console.error('Fetch reaction error:', error); return; }
    }
    if (user.bot) return;

    
    if (reaction.emoji.name === '🎉' && giveaways[reaction.message.id] && !giveaways[reaction.message.id].role) {
        const giveaway = giveaways[reaction.message.id];
        if (!giveaway.participants.includes(user.id)) {
            giveaway.participants.push(user.id);
            fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
            const msg = await reaction.message.channel.send({ embeds: [createEmbed('Participation', `<@${user.id}> a participé!`)] });
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }
    }

    
    if (reaction.emoji.name === '✅' && regulations[reaction.message.id]) {
        try {
            const regData = regulations[reaction.message.id];
            const member = await reaction.message.guild.members.fetch(user.id);
            const role = await reaction.message.guild.roles.fetch(regData.roleId);
            
            if (!member || !role) return;
            
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                const conf = await reaction.message.channel.send({ embeds: [createEmbed('✅ Accepté', `<@${user.id}> a accepté le règlement → ${role.name}`)] });
                setTimeout(() => conf.delete().catch(() => {}), 5000);
            }
        } catch (err) {
            console.error('Règlement error:', err);
        }
    }
});
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'open_ticket') {
        try {
            const existingTicket = interaction.guild.channels.cache.find(
                channel => channel.name === `ticket-${interaction.user.id}`
            );

            if (existingTicket) {
                return await interaction.reply({
                    content: 'Vous avez déjà un ticket ouvert!',
                    ephemeral: true
                });
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.id}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                    {
                        id: interaction.guild.roles.cache.find(role => 
                            role.permissions.has(PermissionFlagsBits.Administrator)
                        ).id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    }
                ]
            });

            const closeButton = new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Fermer le ticket')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(closeButton);

            const ticketEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Ticket de ${interaction.user.tag}`)
                .setDescription('Merci de décrire votre problème. Un membre du staff vous répondra dès que possible.')
                .setTimestamp();

            await ticketChannel.send({
                embeds: [ticketEmbed],
                components: [row]
            });

            await interaction.reply({ 
                content: `Votre ticket a été créé: ${ticketChannel}`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Erreur lors de la création du ticket:', error);
            await interaction.reply({ 
                content: 'Une erreur est survenue lors de la création du ticket.', 
                ephemeral: true 
            });
        }
    } else if (interaction.customId === 'close_ticket') {
        if (!interaction.channel.name.startsWith('ticket-')) {
            return await interaction.reply({
                content: 'Cette commande ne peut être utilisée que dans un ticket.',
                ephemeral: true
            });
        }

        await interaction.reply({ 
            content: 'Le ticket sera fermé dans 5 secondes...' 
        });

        setTimeout(async () => {
            await interaction.channel.delete();
        }, 5000);
    }
});

process.on('exit', () => {
    try { saveAllData(); console.log('Données sauvegardées.'); } catch (e) { console.error('Save error:', e); }
});

process.on('SIGINT', () => {
    try { saveAllData(); console.log('Données sauvegardées avant fermeture.'); } catch (e) { console.error('Save error:', e); }
    process.exit(0);
});


client.login(token);