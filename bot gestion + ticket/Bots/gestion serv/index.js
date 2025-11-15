// Require the necessary discord.js classes  
const { Client, Events, GatewayIntentBits, PermissionsBitField, EmbedBuilder, REST, Routes } = require('discord.js');
const { token, clientId, guildId } = require('./config.json');
const fs = require('fs');

// Chargement des données existantes
let levels = {};
try { levels = require('./levels.json'); } catch (e) { levels = {}; }

let deletedMessages = [];

// Charger ou initialiser les informations économiques 
let economy = { daily: 100, monthly: 500 }; // Sommes par défaut  
let usersEconomy = {};
let roleLevels = {}; // Pour stocker les rôles de niveaux  
let games = {}; // Pour stocker l'état des jeux  
let giveaways = {}; // Pour stocker l'état des giveaways
let shop = {}; // <-- boutique par guild

// Tenter de charger économie (balances) et roles et boutique
try {
    const economyData = fs.readFileSync('./économie.json', 'utf8');
    usersEconomy = JSON.parse(economyData);
} catch (err) {
    console.log('Aucune donnée économique trouvée, initialisation avec des valeurs par défaut.');
    usersEconomy = {};
}

try {
    const roleData = fs.readFileSync('./roles.json', 'utf8');
    roleLevels = JSON.parse(roleData);
} catch (err) {
    console.log('Aucune donnée de rôle trouvée, initialisation avec des valeurs par défaut.');
    roleLevels = {};
}

try {
    const shopData = fs.readFileSync('./boutique.json', 'utf8');
    shop = JSON.parse(shopData);
} catch (err) {
    console.log('Aucune donnée de boutique trouvée, initialisation vide.');
    shop = {};
}

// Create a new client instance  
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ] 
});

// Helpers
function createEmbed(title, description, color = 0x00AE86) {
    return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}
function logInteraction(username, content) {
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const logMessage = `[${timestamp}] ${username}: ${content}\n`;
    fs.appendFileSync('logs.txt', logMessage);
    console.log(logMessage);
}
function saveShop() {
    fs.writeFileSync('./boutique.json', JSON.stringify(shop, null, 2));
}
function saveEconomyFile() {
    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
}

// When the client is ready, run this code (only once).
client.once(Events.ClientReady, readyClient => {
    console.log(`Prêt ! ${readyClient.user.tag} est en service !`);
});

// Événement pour gagner de l'XP en envoyant des messages
client.on(Events.MessageCreate, message => {
    if (message.author.bot) return; // Ignorer les messages des bots
    addXP(message.author.id, 15, message.channel);
});

// Register commands  
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

    // ----- BOUTIQUE : commandes ajoutées -----
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
    {
        name: 'acheter',
        description: 'Achetez un article par son index.',
        options: [
            { type: 4, name: 'index', description: 'Index de l\'article (voir /boutique)', required: true }
        ]
    },
    // ----- fin boutique -----
];

// Enregistrer les commandes slash dans Discord  
const rest = new REST({ version: '9' }).setToken(token);
(async () => {
    try {
        console.log('Début de l\'enregistrement des commandes slash...');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Commandes slash enregistrées avec succès.');
    } catch (error) {
        console.error(error);
    }
})();

// Event to track deleted messages  
client.on(Events.MessageDelete, message => {
    if (message.partial) return;
    deletedMessages.unshift(message);
    if (deletedMessages.length > 10) deletedMessages.pop();
    if (message.author) logInteraction(message.author.tag, `Message supprimé: ${message.content}`);
});

// Handle interactions  
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;
    const { commandName, options } = interaction;

    try {
        switch (commandName) {
            case 'ping': {
                const sentMessage = await interaction.reply({ embeds: [createEmbed('Ping', 'Calcul en cours...')], fetchReply: true });
                const ping = sentMessage.createdTimestamp - interaction.createdTimestamp;
                await interaction.editReply({ embeds: [createEmbed('Ping', `🏓 Le ping du bot est de **${ping} ms**.`)] });
                break;
            }

            case 'salon-reset': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const channel = interaction.channel;
                const fetchedMessages = await channel.messages.fetch({ limit: 100 });
                await channel.bulkDelete(fetchedMessages, true).catch(error => console.error('Erreur bulkDelete:', error));
                await interaction.reply({ embeds: [createEmbed('Succès', 'Tous les messages dans ce salon ont été supprimés.')] });
                break;
            }

            case 'send-embed': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                await interaction.deferReply({ ephemeral: true });
                const embedTitle = options.getString('title');
                const embedMessage = options.getString('message').replace(/\\n/g, '\n');
                const customEmbed = new EmbedBuilder().setColor(0x00AE86).setTitle(embedTitle).setDescription(embedMessage).setTimestamp();
                await interaction.channel.send({ embeds: [customEmbed] });
                await interaction.editReply({ embeds: [createEmbed('Succès', 'L\'embed a été envoyé avec succès.')] });
                break;
            }

            case 'ban': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const userToBan = options.getUser('user');
                const reasonBan = options.getString('reason') || 'Aucune raison spécifiée';
                const memberToBan = await interaction.guild.members.fetch(userToBan.id).catch(() => null);
                if (memberToBan) {
                    await memberToBan.ban({ reason: reasonBan });
                    await interaction.reply({ embeds: [createEmbed('Bannissement', `${userToBan.tag} a été banni pour la raison suivante : ${reasonBan}`)] });
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur non trouvé.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'mute': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const userToMute = options.getUser('user');
                const durationMute = options.getInteger('duration');
                const reasonMute = options.getString('reason') || 'Aucune raison spécifiée';
                const memberToMute = await interaction.guild.members.fetch(userToMute.id).catch(() => null);
                if (memberToMute) {
                    const muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
                    if (!muteRole) {
                        await interaction.reply({ embeds: [createEmbed('Erreur', 'Rôle "Muted" non trouvé.', 0xff0000)], ephemeral: true });
                        return;
                    }
                    await memberToMute.roles.add(muteRole, reasonMute);
                    await interaction.reply({ embeds: [createEmbed('Mute', `${userToMute.tag} a été mute pour la raison suivante : ${reasonMute}`)] });
                    setTimeout(async () => {
                        try {
                            const refreshed = await interaction.guild.members.fetch(userToMute.id);
                            if (refreshed.roles.cache.has(muteRole.id)) {
                                await refreshed.roles.remove(muteRole, 'Mute terminé');
                                await interaction.channel.send({ embeds: [createEmbed('Unmute', `${userToMute.tag} a été unmute.`)] });
                            }
                        } catch (err) { console.error('Erreur unmute', err); }
                    }, durationMute * 60 * 1000);
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur non trouvé.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'unmute': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const userToUnmute = options.getUser('user');
                const memberToUnmute = await interaction.guild.members.fetch(userToUnmute.id).catch(() => null);
                if (memberToUnmute) {
                    const muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
                    if (!muteRole) {
                        await interaction.reply({ embeds: [createEmbed('Erreur', 'Rôle "Muted" non trouvé.', 0xff0000)], ephemeral: true });
                        return;
                    }
                    if (memberToUnmute.roles.cache.has(muteRole.id)) {
                        await memberToUnmute.roles.remove(muteRole, 'Unmute command');
                        await interaction.reply({ embeds: [createEmbed('Unmute', `${userToUnmute.tag} a été unmute.`)] });
                    } else {
                        await interaction.reply({ embeds: [createEmbed('Erreur', `${userToUnmute.tag} n'est pas mute.`, 0xff0000)], ephemeral: true });
                    }
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur non trouvé.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            case 'level': {
                await interaction.deferReply();
                const userLevelID = interaction.user.id;
                if (!levels[userLevelID]) levels[userLevelID] = { xp: 0, level: 1 };
                const xpNeeded = levels[userLevelID].level * 100;
                const currentXP = levels[userLevelID].xp;
                const currentLevel = levels[userLevelID].level;
                const levelEmbed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle(`Niveau de ${interaction.user.username}`)
                    .setDescription(`📊 **Niveau**: ${currentLevel}\n✨ **XP**: ${currentXP}/${xpNeeded}\n🎯 **Prochain niveau**: ${xpNeeded - currentXP} XP restants`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [levelEmbed] });
                break;
            }

            case 'leaderboard': {
                const leaderboard = getLeaderboard();
                let leaderboardMessage = '🏆 **Leaderboard des niveaux** 🏆\n\n';
                leaderboard.forEach((user, index) => {
                    leaderboardMessage += `${index + 1}. <@${user.id}> - Niveau ${user.level} (${user.xp} XP)\n`;
                });
                await interaction.reply({ embeds: [createEmbed('Leaderboard', leaderboardMessage)] });
                break;
            }

            case 'envoyer': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const messageToSend = options.getString('message');
                await interaction.channel.send(messageToSend);
                await interaction.reply({ embeds: [createEmbed('Message envoyé', 'Le message a été envoyé avec succès.')], ephemeral: true });
                break;
            }

            case 'config-économie': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const dailyAmount = options.getInteger('daily');
                const monthlyAmount = options.getInteger('monthly');
                economy.daily = dailyAmount;
                economy.monthly = monthlyAmount;
                // Note : ce code sauvegarde l'objet economy dans économie.json (existant code)
                fs.writeFileSync('./économie.json', JSON.stringify(economy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Configuration Économie', `Montants configurés:\n- Quotidien: ${dailyAmount}\n- Mensuel: ${monthlyAmount}`)] });
                break;
            }

            case 'daily': {
                const userDailyID = interaction.user.id;
                if (!usersEconomy[userDailyID]) usersEconomy[userDailyID] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                const nowDaily = Date.now();
                const dailyCooldown = 86400000;
                if (nowDaily - usersEconomy[userDailyID].lastDaily < dailyCooldown) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez attendre 24 heures avant de réclamer votre récompense quotidienne.', 0xff0000)], ephemeral: true });
                } else {
                    usersEconomy[userDailyID].balance += economy.daily;
                    usersEconomy[userDailyID].lastDaily = nowDaily;
                    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                    await interaction.reply({ embeds: [createEmbed('Succès', `Vous avez réclamé ${economy.daily} pièces pour votre récompense quotidienne!`)] });
                }
                break;
            }

            case 'monthly': {
                const userMonthlyID = interaction.user.id;
                if (!usersEconomy[userMonthlyID]) usersEconomy[userMonthlyID] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                const nowMonthly = Date.now();
                const monthlyCooldown = 2592000000;
                if (nowMonthly - usersEconomy[userMonthlyID].lastMonthly < monthlyCooldown) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez attendre 30 jours avant de réclamer votre récompense mensuelle.', 0xff0000)], ephemeral: true });
                } else {
                    usersEconomy[userMonthlyID].balance += economy.monthly;
                    usersEconomy[userMonthlyID].lastMonthly = nowMonthly;
                    fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                    await interaction.reply({ embeds: [createEmbed('Succès', `Vous avez réclamé ${economy.monthly} pièces pour votre récompense mensuelle!`)] });
                }
                break;
            }

            case 'role-level': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const lvl = options.getInteger('level');
                const rl = options.getRole('role');
                roleLevels[lvl] = rl.id;
                fs.writeFileSync('./roles.json', JSON.stringify(roleLevels, null, 2));
                await interaction.reply({ embeds: [createEmbed('Rôle Défini', `Le rôle <@&${rl.id}> a été défini pour le niveau ${lvl}.`)] });
                break;
            }

            case 'giveaway': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                const prize = options.getString('prize');
                const winnersCount = options.getInteger('winners');
                const duration = options.getInteger('duration') * 60000;
                const giveawayMessage = await interaction.reply({
                    embeds: [createEmbed('Concours', `🎉 **Concours !** 🎉\n\nObjet à gagner : ${prize}\nNombre de gagnants : ${winnersCount}\nDurée : ${options.getInteger('duration')} minutes\n\nRéagissez à ce message pour participer !`)],
                    fetchReply: true
                });
                await giveawayMessage.react('🎉');
                giveaways[giveawayMessage.id] = { prize, winnersCount, participants: [], endTime: Date.now() + duration };
                setTimeout(async () => {
                    if (giveaways[giveawayMessage.id]) {
                        const giveaway = giveaways[giveawayMessage.id];
                        const winnerList = giveaway.participants.length > 0 ? getRandomWinners(giveaway.participants, giveaway.winnersCount) : ['Aucun gagnant !'];
                        fs.writeFileSync('giveaway-enter.txt', giveaway.participants.join('\n'));
                        await interaction.channel.send({ embeds: [createEmbed('Concours Terminé', `🎉 **Concours terminé !** 🎉\n\nObjet à gagner : ${giveaway.prize}\nGagnants : ${winnerList.join(', ')}`)] });
                        fs.truncate('giveaway-enter.txt', 0, () => {});
                        delete giveaways[giveawayMessage.id];
                    }
                }, duration);
                break;
            }

            case 'règlement': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                    return;
                }
                await interaction.deferReply();
                const ruleContent = options.getString('content').replace(/\\n/g, '\n');
                const roleToAssign = options.getRole('role');
                const ruleEmbed = new EmbedBuilder().setColor(0x00AE86).setTitle('Règlement').setDescription(ruleContent).setFooter({ text: 'Réagissez avec ✅ pour accepter le règlement' }).setTimestamp();
                const ruleMessage = await interaction.channel.send({ embeds: [ruleEmbed] });
                await ruleMessage.react('✅');
                giveaways[ruleMessage.id] = { participants: [], role: { id: roleToAssign.id, name: roleToAssign.name } };
                await interaction.editReply({ embeds: [createEmbed('Succès', 'Le règlement a été envoyé avec succès.')] });
                break;
            }

            // ====== BOUTIQUE ======
            case 'config-boutique': {
                // réservé aux administrateurs
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Seuls les administrateurs peuvent configurer la boutique.', 0xff0000)], ephemeral: true });
                    return;
                }
                const roleObj = options.getRole('role');
                const price = options.getInteger('price');
                const name = options.getString('name') || roleObj.name;
                const gid = interaction.guild.id;
                if (!shop[gid]) shop[gid] = [];
                shop[gid].push({ id: roleObj.id, name, price });
                saveShop();
                await interaction.reply({ embeds: [createEmbed('Boutique', `Article ajouté : **${name}** — Rôle: <@&${roleObj.id}> — Prix: ${price} pièces`)] });
                break;
            }

            case 'boutique': {
                const gid = interaction.guild.id;
                const items = shop[gid] || [];
                if (items.length === 0) {
                    await interaction.reply({ embeds: [createEmbed('Boutique', 'Aucun article disponible pour le moment.')], ephemeral: false });
                    return;
                }
                const embed = new EmbedBuilder().setTitle('Boutique du serveur').setColor(0x00AE86).setTimestamp();
                let desc = '';
                items.forEach((it, idx) => { desc += `**${idx + 1}. ${it.name}**\nRôle: <@&${it.id}>\nPrix: ${it.price} pièces\n\n`; });
                embed.setDescription(desc).setFooter({ text: 'Achetez avec /acheter <index>' });
                await interaction.reply({ embeds: [embed] });
                break;
            }

            case 'acheter': {
                const idx = options.getInteger('index');
                const gid = interaction.guild.id;
                const items = shop[gid] || [];
                if (!idx || idx < 1 || idx > items.length) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Index invalide.' , 0xff0000)], ephemeral: true });
                    return;
                }
                const item = items[idx - 1];
                const uid = interaction.user.id;
                if (!usersEconomy[uid]) usersEconomy[uid] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
                if (usersEconomy[uid].balance < item.price) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Fonds insuffisants pour cet achat.', 0xff0000)], ephemeral: true });
                    return;
                }
                usersEconomy[uid].balance -= item.price;
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                try {
                    const member = await interaction.guild.members.fetch(uid);
                    const roleObj = await interaction.guild.roles.fetch(item.id);
                    if (member && roleObj) {
                        await member.roles.add(roleObj, 'Achat boutique');
                        await interaction.reply({ embeds: [createEmbed('Achat réussi', `Vous avez acheté **${item.name}** pour ${item.price} pièces. Rôle ajouté : ${roleObj.name}`)] });
                    } else {
                        await interaction.reply({ embeds: [createEmbed('Achat', 'Achat enregistré mais rôle/membre introuvable. Vous avez été débité.')], ephemeral: true });
                    }
                } catch (err) {
                    console.error('Erreur achat:', err);
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Erreur lors de l\'attribution du rôle après achat.', 0xff0000)], ephemeral: true });
                }
                break;
            }

            default:
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Commande non implémentée.')], ephemeral: true });
                break;
        }
    } catch (err) {
        console.error('Erreur interaction:', err);
        if (!interaction.replied) await interaction.reply({ embeds: [createEmbed('Erreur', 'Une erreur est survenue.', 0xff0000)], ephemeral: true });
    }
});

// Handling message reaction for regulations & giveaways  
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) {
        try { await reaction.fetch(); } catch (error) { console.error('Erreur fetch reaction', error); return; }
    }
    if (user.bot) return;

    if (reaction.emoji.name === '🎉' && giveaways[reaction.message.id]) {
        const giveaway = giveaways[reaction.message.id];
        if (!giveaway.participants.includes(user.id)) {
            giveaway.participants.push(user.id);
            fs.appendFileSync('giveaway-enter.txt', `${user.id}\n`);
            const msg = await reaction.message.channel.send({ embeds: [createEmbed('Participation', `<@${user.id}> a participé au concours pour le prix : ${giveaway.prize}`)] });
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }
    }

    if (reaction.emoji.name === '✅' && giveaways[reaction.message.id]) {
        try {
            const member = await reaction.message.guild.members.fetch(user.id);
            const giveawayData = giveaways[reaction.message.id];
            if (!member || !giveawayData || !giveawayData.role) return;
            const role = await reaction.message.guild.roles.fetch(giveawayData.role.id);
            if (!role) return;
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                const conf = await reaction.message.channel.send({ embeds: [createEmbed('Règlement accepté', `<@${user.id}> a accepté le règlement et reçu le rôle ${role.name}`)] });
                setTimeout(() => conf.delete().catch(() => {}), 5000);
            }
        } catch (err) {
            console.error('Erreur attribution rôle règlement', err);
        }
    }
});

// Fonction pour obtenir un nombre aléatoire de gagnants  
function getRandomWinners(participants, count) {
    const shuffled = participants.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(userId => `<@${userId}>`);
}

// Function to add XP and update levels  
function addXP(userID, xpToAdd, channel) {
    if (!levels[userID]) levels[userID] = { xp: 0, level: 1 };
    levels[userID].xp += xpToAdd;
    let xpNeeded = levels[userID].level * 100;
    if (levels[userID].xp >= xpNeeded) {
        levels[userID].level++;
        levels[userID].xp = 0;
        if (channel) channel.send({ embeds: [createEmbed('Niveau Supérieur!', `<@${userID}> est maintenant niveau ${levels[userID].level}!`)] });
    }
    fs.writeFileSync('./levels.json', JSON.stringify(levels, null, 2));
}

// Function to get the leaderboard  
function getLeaderboard() {
    let leaderboard = Object.entries(levels).map(([id, data]) => ({ id, ...data }));
    leaderboard.sort((a, b) => (b.level === a.level) ? b.xp - a.xp : b.level - a.level);
    return leaderboard.slice(0, 10);
}

// Save levels data on exit  
process.on('exit', () => {
    try { fs.writeFileSync('./levels.json', JSON.stringify(levels, null, 2)); } catch (e) { console.error(e); }
});

// Log in to Discord with your client's token  
client.login(token);