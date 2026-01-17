const { Client, Events, GatewayIntentBits, PermissionsBitField, EmbedBuilder, REST, Routes } = require('discord.js');
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

let deletedMessages = [];
let economy = { daily: 100, monthly: 500 };


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
    fs.writeFileSync('./roles.json', JSON.stringify(roleLevels, null, 2));
    fs.writeFileSync('./boutique.json', JSON.stringify(shop, null, 2));
    fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
    fs.writeFileSync('./reglements.json', JSON.stringify(regulations, null, 2));
}

function getRandomWinners(participants, count) {
    const shuffled = participants.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(userId => `<@${userId}>`);
}

function addXP(userID, xpToAdd, channel) {
    if (!levels[userID]) levels[userID] = { xp: 0, level: 1 };
    levels[userID].xp += xpToAdd;
    let xpNeeded = levels[userID].level * 100;
    if (levels[userID].xp >= xpNeeded) {
        levels[userID].level++;
        levels[userID].xp = 0;
        if (channel) channel.send({ embeds: [createEmbed('Niveau Supérieur!', `<@${userID}> est maintenant niveau ${levels[userID].level}!`)] });
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
    { name: 'ping', description: 'Affiche le ping du bot.' },
    { name: 'snipe', description: 'Affiche le dernier message supprimé (admins seulement).' },
    {
        name: 'send-embed',
        description: 'Envoie un message dans un embed personnalisé.',
        options: [
            { type: 3, name: 'title', description: 'Le titre de l\'embed.', required: true },
            { type: 3, name: 'message', description: 'Le message à envoyer dans l\'embed. Utilisez \\n pour les retours à la ligne.', required: true }
        ]
    },
    {
        name: 'ban',
        description: 'Bannit un utilisateur.',
        options: [
            { type: 6, name: 'user', description: 'L\'utilisateur à bannir.', required: true },
            { type: 3, name: 'reason', description: 'La raison du bannissement.', required: false }
        ]
    },
    {
        name: 'mute',
        description: 'Mute un utilisateur.',
        options: [
            { type: 6, name: 'user', description: 'L\'utilisateur à mute.', required: true },
            { type: 4, name: 'duration', description: 'Durée en minutes.', required: true },
            { type: 3, name: 'reason', description: 'La raison du mute.', required: false }
        ]
    },
    { name: 'unmute', description: 'Unmute un utilisateur.', options: [{ type: 6, name: 'user', description: 'L\'utilisateur à unmute.', required: true }] },
    { name: 'level', description: 'Affiche votre niveau.' },
    { name: 'leaderboard', description: 'Affiche le leaderboard des niveaux.' },
    { name: 'envoyer', description: 'Envoie un message sous le nom du bot.', options: [{ type: 3, name: 'message', description: 'Le message à envoyer.', required: true }] },
    { name: 'salon-reset', description: 'Supprime tous les messages dans le salon actuel.' },
    {
        name: 'config-économie',
        description: 'Configure les montants de l\'économie.',
        options: [
            { type: 4, name: 'daily', description: 'Montant de la récompense quotidienne.', required: true },
            { type: 4, name: 'monthly', description: 'Montant de la récompense mensuelle.', required: true }
        ]
    },
    { name: 'daily', description: 'Réclamez votre récompense quotidienne.' },
    { name: 'monthly', description: 'Réclamez votre récompense mensuelle.' },
    {
        name: 'role-level',
        description: 'Définit un rôle pour un niveau spécifique.',
        options: [
            { type: 4, name: 'level', description: 'Niveau pour lequel définir le rôle.', required: true },
            { type: 8, name: 'role', description: 'Rôle à attribuer.', required: true }
        ]
    },
    {
        name: 'giveaway',
        description: 'Créez un concours.',
        options: [
            { type: 3, name: 'prize', description: 'Objet à gagner.', required: true },
            { type: 4, name: 'winners', description: 'Nombre de gagnants.', required: true },
            { type: 4, name: 'duration', description: 'Durée en minutes.', required: true }
        ]
    },
    {
        name: 'règlement',
        description: 'Créez un règlement pour le serveur.',
        options: [
            { type: 3, name: 'content', description: 'Le contenu du règlement. Utilisez \\n pour les retours à la ligne.', required: true },
            { type: 8, name: 'role', description: 'Le rôle à attribuer aux utilisateurs qui réagissent.', required: true }
        ]
    },
    {
        name: 'config-boutique',
        description: 'Ajoute un article en boutique (Admin uniquement).',
        options: [
            { type: 8, name: 'role', description: 'Rôle à vendre', required: true },
            { type: 4, name: 'price', description: 'Prix en pièces', required: true },
            { type: 3, name: 'name', description: 'Nom affiché (optionnel)', required: false }
        ]
    },
    { name: 'boutique', description: 'Affiche la boutique du serveur.' },
    { name: 'acheter', description: 'Achetez un article par son index.', options: [{ type: 4, name: 'index', description: 'Index de l\'article (voir /boutique)', required: true }] },
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
});

client.on(Events.MessageCreate, message => {
    if (message.author.bot) return;
    addXP(message.author.id, 15, message.channel);
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
            case 'ping': {
                const sentMessage = await interaction.reply({ embeds: [createEmbed('Ping', 'Calcul...')], fetchReply: true });
                const ping = sentMessage.createdTimestamp - interaction.createdTimestamp;
                await interaction.editReply({ embeds: [createEmbed('Ping', `🏓 ${ping} ms`)] });
                break;
            }

            case 'salon-reset': {
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

            case 'send-embed': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                await interaction.deferReply({ ephemeral: true });
                const title = options.getString('title');
                const msg = options.getString('message').replace(/\\n/g, '\n');
                await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle(title).setDescription(msg).setColor(0x00AE86).setTimestamp()] });
                await interaction.editReply({ embeds: [createEmbed('Succès', 'Embed envoyé.')] });
                break;
            }

            case 'ban': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('user');
                const reason = options.getString('reason') || 'Aucune raison';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                if (member) {
                    await member.ban({ reason });
                    await interaction.reply({ embeds: [createEmbed('Ban', `${user.tag} banni : ${reason}`)] });
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur introuvable.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'mute': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('user');
                const duration = options.getInteger('duration');
                const reason = options.getString('reason') || 'Aucune raison';
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

            case 'unmute': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const user = options.getUser('user');
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

            case 'level': {
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

            case 'leaderboard': {
                const lb = getLeaderboard();
                let txt = '';
                lb.forEach((u, i) => { txt += `${i + 1}. <@${u.id}> — Lvl ${u.level} (${u.xp} XP)\n`; });
                await interaction.reply({ embeds: [createEmbed('Leaderboard', txt || 'Aucun')] });
                break;
            }

            case 'envoyer': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const msg = options.getString('message');
                await interaction.channel.send(msg);
                await interaction.reply({ embeds: [createEmbed('Succès', 'Message envoyé.')] , ephemeral: true });
                break;
            }

            case 'config-économie': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                economy.daily = options.getInteger('daily');
                economy.monthly = options.getInteger('monthly');
                fs.writeFileSync('./économie.json', JSON.stringify(economy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Config Économie', `Daily: ${economy.daily}\nMonthly: ${economy.monthly}`)] });
                break;
            }

            case 'daily': {
                const uid = interaction.user.id;
                if (!usersEconomy[uid]) usersEconomy[uid] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                const now = Date.now();
                if (now - usersEconomy[uid].lastDaily < 86400000) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Attendre 24h.', 0xff0000)], ephemeral: true });
                } else {
                    usersEconomy[uid].lastDaily = now;
                    usersEconomy[uid].balance += economy.daily;
                    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                    await interaction.reply({ embeds: [createEmbed('Succès', `+${economy.daily} pièces!`)] });
                }
                break;
            }

            case 'monthly': {
                const uid = interaction.user.id;
                if (!usersEconomy[uid]) usersEconomy[uid] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                const now = Date.now();
                if (now - usersEconomy[uid].lastMonthly < 2592000000) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Attendre 30j.', 0xff0000)], ephemeral: true });
                } else {
                    usersEconomy[uid].lastMonthly = now;
                    usersEconomy[uid].balance += economy.monthly;
                    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                    await interaction.reply({ embeds: [createEmbed('Succès', `+${economy.monthly} pièces!`)] });
                }
                break;
            }

            case 'role-level': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const lvl = options.getInteger('level');
                const role = options.getRole('role');
                roleLevels[lvl] = role.id;
                fs.writeFileSync('./roles.json', JSON.stringify(roleLevels, null, 2));
                await interaction.reply({ embeds: [createEmbed('Rôle Défini', `Lvl ${lvl} → <@&${role.id}>`)] });
                break;
            }

            case 'giveaway': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                const prize = options.getString('prize');
                const winnersCount = options.getInteger('winners');
                const duration = options.getInteger('duration') * 60000;
                const msg = await interaction.reply({
                    embeds: [createEmbed('Concours', `🎉 **Concours !** 🎉\n\nPrix: ${prize}\nGagnants: ${winnersCount}\nDurée: ${options.getInteger('duration')}min\n\nRéagissez 🎉 pour participer!`)],
                    fetchReply: true
                });
                await msg.react('🎉');
                giveaways[msg.id] = { prize, winnersCount, participants: [], endTime: Date.now() + duration, guildId: interaction.guild.id, channelId: interaction.channel.id };
                fs.writeFileSync('./concours.json', JSON.stringify(giveaways, null, 2));
                setTimeout(() => finishGiveaway(msg.id), duration);
                break;
            }

            case 'règlement': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Admin requis.', 0xff0000)], ephemeral: true });
                    return;
                }
                await interaction.deferReply();
                const content = options.getString('content').replace(/\\n/g, '\n');
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
                const price = options.getInteger('price');
                const name = options.getString('name') || role.name;
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


process.on('exit', () => {
    try { saveAllData(); console.log('Données sauvegardées.'); } catch (e) { console.error('Save error:', e); }
});

process.on('SIGINT', () => {
    try { saveAllData(); console.log('Données sauvegardées avant fermeture.'); } catch (e) { console.error('Save error:', e); }
    process.exit(0);
});


client.login(token);
