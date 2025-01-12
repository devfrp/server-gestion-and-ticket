// Require the necessary discord.js classes  
const { Client, Events, GatewayIntentBits, PermissionsBitField, EmbedBuilder, REST, Routes } = require('discord.js');
const { token, clientId, guildId } = require('./config.json');
const fs = require('fs');
let levels = require('./levels.json');
let deletedMessages = [];
// ...existing code...
// ...existing code...
// Charger ou initialiser les informations économiques 
let economy = { daily: 100, monthly: 500 }; // Sommes par défaut  
let usersEconomy = {};
let roleLevels = {}; // Pour stocker les rôles de niveaux  
let games = {}; // Pour stocker l'état des jeux  
let giveaways = {}; // Pour stocker l'état des giveaways

// Tenter de charger economy.json et roles.json  
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

// Create a new client instance  
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });

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
    {
        name: 'ping',
        description: 'Affiche le ping du bot.',
    },
    {
        name: 'snipe',
        description: 'Affiche le dernier message supprimé (admins seulement).',
    },
{
    name: 'send-embed',
    description: 'Envoie un message dans un embed personnalisé.',
    options: [
        {
            type: 3, // STRING type
            name: 'title',
            description: 'Le titre de l\'embed.',
            required: true
        },
        {
            type: 3, // STRING type
            name: 'message',
            description: 'Le message à envoyer dans l\'embed. Utilisez \\n pour les retours à la ligne.',
            required: true
        }
    ]
},
    {
        name: 'ban',
        description: 'Bannit un utilisateur.',
        options: [
            {
                type: 6, // USER type  
                name: 'user',
                description: 'L\'utilisateur à bannir.',
                required: true  
            },
            {
                type: 3, // STRING type  
                name: 'reason',
                description: 'La raison du bannissement.',
                required: false  
            }
        ]
    },
    {
        name: 'mute',
        description: 'Mute un utilisateur.',
        options: [
            {
                type: 6, // USER type  
                name: 'user',
                description: 'L\'utilisateur à mute.',
                required: true  
            },
            {
                type: 4, // INTEGER type  
                name: 'duration',
                description: 'Durée en minutes.',
                required: true  
            },
            {
                type: 3, // STRING type  
                name: 'reason',
                description: 'La raison du mute.',
                required: false  
            }
        ]
    },
    {
        name: 'unmute',
        description: 'Unmute un utilisateur.',
        options: [
            {
                type: 6, // USER type  
                name: 'user',
                description: 'L\'utilisateur à unmute.',
                required: true  
            }
        ]
    },
    {
        name: 'level',
        description: 'Affiche votre niveau.',
    },
    {
        name: 'leaderboard',
        description: 'Affiche le leaderboard des niveaux.',
    },
    {
        name: 'envoyer',
        description: 'Envoie un message sous le nom du bot.',
        options: [
            {
                type: 3, // STRING type  
                name: 'message',
                description: 'Le message à envoyer.',
                required: true  
            }
        ]
    },
    {
        name: 'salon-reset',
        description: 'Supprime tous les messages dans le salon actuel.',
    },
    {
        name: 'config-économie',
        description: 'Configure les montants de l\'économie.',
        options: [
            {
                type: 4, // INTEGER type  
                name: 'daily',
                description: 'Montant de la récompense quotidienne.',
                required: true  
            },
            {
                type: 4, // INTEGER type  
                name: 'monthly',
                description: 'Montant de la récompense mensuelle.',
                required: true  
            }
        ]
    },
    {
        name: 'daily',
        description: 'Réclamez votre récompense quotidienne.',
    },
    {
        name: 'monthly',
        description: 'Réclamez votre récompense mensuelle.',
    },
    {
        name: 'role-level',
        description: 'Définit un rôle pour un niveau spécifique.',
        options: [
            {
                type: 4, // INTEGER type  
                name: 'level',
                description: 'Niveau pour lequel définir le rôle.',
                required: true  
            },
            {
                type: 8, // ROLE type  
                name: 'role',
                description: 'Rôle à attribuer.',
                required: true  
            }
        ]
    },
    {
        name: 'giveaway',
        description: 'Créez un concours.',
        options: [
            {
                type: 3, // STRING type  
                name: 'prize',
                description: 'Objet à gagner.',
                required: true  
            },
            {
                type: 4, // INTEGER type  
                name: 'winners',
                description: 'Nombre de gagnants.',
                required: true  
            },
            {
                type: 4, // INTEGER type  
                name: 'duration',
                description: 'Durée en minutes.',
                required: true  
            }
        ]
    },
   {
    name: 'règlement',
    description: 'Créez un règlement pour le serveur.',
    options: [
        {
            type: 3, // STRING type
            name: 'content',
            description: 'Le contenu du règlement. Utilisez \\n pour les retours à la ligne.',
            required: true
        },
        {
            type: 8, // ROLE type
            name: 'role',
            description: 'Le rôle à attribuer aux utilisateurs qui réagissent.',
            required: true
        }
    ]
}
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

client.on('messageCreate', async message => {
    if (message.content === '/règlement') {
        try {
            // Envoyer le message de règlement
            const reglementMessage = await message.channel.send('Voici le règlement du serveur...');
            
            // Ajouter une réaction au message de règlement
            await reglementMessage.react('✅');
        } catch (error) {
            console.error('Erreur lors de l\'ajout de la réaction:', error);
        }
    }
});


// Function to log interactions to logs.txt  
function logInteraction(username, content) {
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    const logMessage = `[${timestamp}] ${username}: ${content}\n`;
    fs.appendFileSync('logs.txt', logMessage);
    console.log(logMessage);
}

// Create an embed message  
function createEmbed(title, description, color = 0x00AE86) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

// Event to track deleted messages  
client.on('messageDelete', message => {
    if (message.partial) return;
    deletedMessages.unshift(message); // Add the deleted message to the beginning of the array  
    if (deletedMessages.length > 1) {
        deletedMessages.pop(); // Remove the last element if array exceeds one message  
    }
    logInteraction(message.author.tag, `Message supprimé: ${message.content}`);
});

// Handle interactions  
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    switch (commandName) {
        case 'ping':
            const sentMessage = await interaction.reply({ embeds: [createEmbed('Ping', 'Calcul en cours...')], fetchReply: true });
            const ping = sentMessage.createdTimestamp - interaction.createdTimestamp; // Calcul du ping en ms  
            await interaction.editReply({ embeds: [createEmbed('Ping', `🏓 Le ping du bot est de **${ping} ms**.`)] });
            break;

        case 'salon-reset':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }

            const channel = interaction.channel;

            // Supprimez tous les messages dans le salon  
            const fetchedMessages = await channel.messages.fetch({ limit: 100 });
            await channel.bulkDelete(fetchedMessages, true).catch(error => {
                console.error('Erreur lors de la suppression des messages:', error);
            });

            // Envoyer un message de confirmation temporaire  
            await interaction.reply({ embeds: [createEmbed('Succès', 'Tous les messages dans ce salon ont été supprimés.')] });
            break;
case 'send-embed':
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
        return;
    }

    // Différer la réponse immédiatement
    await interaction.deferReply({ ephemeral: true });

    const embedTitle = options.getString('title');
    const embedMessage = options.getString('message').replace(/\\n/g, '\n');

    // Créer et envoyer l'embed
    const customEmbed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle(embedTitle)
        .setDescription(embedMessage)
        .setTimestamp();

    await interaction.channel.send({ embeds: [customEmbed] });
    await interaction.editReply({ embeds: [createEmbed('Succès', 'L\'embed a été envoyé avec succès.')] });
    break;

        case 'ban':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }
            const userToBan = options.getUser('user');
            const reasonBan = options.getString('reason') || 'Aucune raison spécifiée';
            const memberToBan = interaction.guild.members.cache.get(userToBan.id);
            
            if (memberToBan) {
                await memberToBan.ban({ reason: reasonBan });
                await interaction.reply({ embeds: [createEmbed('Bannissement', `${userToBan.tag} a été banni pour la raison suivante : ${reasonBan}`)] });
            } else {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur non trouvé.', 0xff0000)] });
            }
            break;

        case 'mute':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }
            const userToMute = options.getUser('user');
            const durationMute = options.getInteger('duration');
            const reasonMute = options.getString('reason') || 'Aucune raison spécifiée';
            const memberToMute = interaction.guild.members.cache.get(userToMute.id);
            
            if (memberToMute) {
                const muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
                if (!muteRole) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Rôle "Muted" non trouvé.', 0xff0000)] });
                    return;
                }
                await memberToMute.roles.add(muteRole, reasonMute);
                await interaction.reply({ embeds: [createEmbed('Mute', `${userToMute.tag} a été mute pour la raison suivante : ${reasonMute}`)] });
                setTimeout(async () => {
                    if (memberToMute.roles.cache.has(muteRole.id)) {
                        await memberToMute.roles.remove(muteRole, 'Mute terminé');
                        await interaction.channel.send({ embeds: [createEmbed('Unmute', `${userToMute.tag} a été unmute.`)] });
                    }
                }, durationMute * 60 * 1000); // Convert duration to milliseconds  
            } else {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur non trouvé.', 0xff0000)] });
            }
            break;

       case 'unmute':
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
        return;
    }
            const userToUnmute = options.getUser('user');
            const memberToUnmute = interaction.guild.members.cache.get(userToUnmute.id);
            
            if (memberToUnmute) {
                const muteRole = interaction.guild.roles.cache.find(role => role.name === 'Muted');
                if (!muteRole) {
                    await interaction.reply({ embeds: [createEmbed('Erreur', 'Rôle "Muted" non trouvé.', 0xff0000)] });
                    return;
                }
                if (memberToUnmute.roles.cache.has(muteRole.id)) {
                    await memberToUnmute.roles.remove(muteRole, 'Unmute command');
                    await interaction.reply({ embeds: [createEmbed('Unmute', `${userToUnmute.tag} a été unmute.`)] });
                } else {
                    await interaction.reply({ embeds: [createEmbed('Erreur', `${userToUnmute.tag} n'est pas mute.`, 0xff0000)] });
                }
            } else {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Utilisateur non trouvé.', 0xff0000)] });
            }
            break;

        case 'level':
    await interaction.deferReply(); // Différer la réponse
    const userLevelID = interaction.user.id;
    
    if (!levels[userLevelID]) {
        levels[userLevelID] = { xp: 0, level: 1 };
    }
    
    const xpNeeded = levels[userLevelID].level * 100;
    const currentXP = levels[userLevelID].xp;
    const currentLevel = levels[userLevelID].level;
    
    const levelEmbed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle(`Niveau de ${interaction.user.username}`)
        .setDescription(`
            📊 **Niveau**: ${currentLevel}
            ✨ **XP**: ${currentXP}/${xpNeeded}
            🎯 **Prochain niveau**: ${xpNeeded - currentXP} XP restants
        `)
        .setTimestamp();

    await interaction.editReply({ embeds: [levelEmbed] });
    break;
        case 'leaderboard':
            const leaderboard = getLeaderboard();
            let leaderboardMessage = '🏆 **Leaderboard des niveaux** 🏆\n\n';
            leaderboard.forEach((user, index) => {
                leaderboardMessage += `${index + 1}. <@${user.id}> - Niveau ${user.level} (${user.xp} XP)\n`;
            });
            await interaction.reply({ embeds: [createEmbed('Leaderboard', leaderboardMessage)] });
            break;

        case 'envoyer':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }
            const messageToSend = options.getString('message');
            await interaction.channel.send(messageToSend); // Envoie le message sous le nom du bot  
            await interaction.reply({ embeds: [createEmbed('Message envoyé', 'Le message a été envoyé avec succès.')], ephemeral: true });
            break;

        case 'config-économie':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }
            // Obtenez les valeurs pour daily et monthly  
            const dailyAmount = options.getInteger('daily');
            const monthlyAmount = options.getInteger('monthly');
            // Configurez les montants  
            economy.daily = dailyAmount;
            economy.monthly = monthlyAmount;

            // Enregistrer les montants dans économie.json  
            fs.writeFileSync('./économie.json', JSON.stringify(economy, null, 2));
            
            await interaction.reply({ embeds: [createEmbed('Configuration Économie', `Montants configurés:\n- Quotidien: ${dailyAmount}\n- Mensuel: ${monthlyAmount}`)] });
            break;

        case 'daily':
            const userDailyID = interaction.user.id;
            if (!usersEconomy[userDailyID]) {
                usersEconomy[userDailyID] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
            }

            // Déclarez maintenant ici  
            const nowDaily = Date.now();
            const dailyCooldown = 86400000; // 24 heures en millisecondes

            if (nowDaily - usersEconomy[userDailyID].lastDaily < dailyCooldown) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez attendre 24 heures avant de réclamer votre récompense quotidienne.', 0xff0000)], ephemeral: true });
            } else {
                usersEconomy[userDailyID].balance += economy.daily;
                usersEconomy[userDailyID].lastDaily = nowDaily;
                // Enregistrer les données économiques dans économie.json  
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `Vous avez réclamé ${economy.daily} pièces pour votre récompense quotidienne!`)] });
            }
            break;

        case 'monthly':
            const userMonthlyID = interaction.user.id;
            if (!usersEconomy[userMonthlyID]) {
                usersEconomy[userMonthlyID] = { lastDaily: 0, lastMonthly: 0, balance: 0 };
            }

            // Déclarez maintenant ici  
            const nowMonthly = Date.now();
            const monthlyCooldown = 2592000000; // 30 jours en millisecondes

            if (nowMonthly - usersEconomy[userMonthlyID].lastMonthly < monthlyCooldown) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez attendre 30 jours avant de réclamer votre récompense mensuelle.', 0xff0000)], ephemeral: true });
            } else {
                usersEconomy[userMonthlyID].balance += economy.monthly;
                usersEconomy[userMonthlyID].lastMonthly = nowMonthly;
                // Enregistrer les données économiques dans économie.json  
                fs.writeFileSync('./économie.json', JSON.stringify(usersEconomy, null, 2));
                await interaction.reply({ embeds: [createEmbed('Succès', `Vous avez réclamé ${economy.monthly} pièces pour votre récompense mensuelle!`)] });
            }
            break;

        case 'role-level':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }

            const level = options.getInteger('level');
            const role = options.getRole('role');

            // Enregistrer le rôle pour le niveau  
            roleLevels[level] = role.id;
            fs.writeFileSync('./roles.json', JSON.stringify(roleLevels, null, 2));

            await interaction.reply({ embeds: [createEmbed('Rôle Défini', `Le rôle <@&${role.id}> a été défini pour le niveau ${level}.`)] });
            break;

            

        case 'giveaway':
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
                return;
            }

            const prize = options.getString('prize');
            const winnersCount = options.getInteger('winners');
            const duration = options.getInteger('duration') * 60000; // Convertit les minutes en millisecondes

            // Créer le message de giveaway  
            const giveawayMessage = await interaction.reply({
                embeds: [createEmbed('Concours', `🎉 **Concours !** 🎉\n\nObjet à gagner : ${prize}\nNombre de gagnants : ${winnersCount}\nDurée : ${options.getInteger('duration')} minutes\n\nRéagissez à ce message pour participer !`)],
                fetchReply: true  
            });

            // Ajouter une réaction pour participer  
            await giveawayMessage.react('🎉');

            // Enregistrer l'état du giveaway  
            giveaways[giveawayMessage.id] = {
                prize,
                winnersCount,
                participants: [],
                endTime: Date.now() + duration  
            };

            // Fin du giveaway après la durée spécifiée  
            setTimeout(async () => {
                if (giveaways[giveawayMessage.id]) {
                    const giveaway = giveaways[giveawayMessage.id];
                    const winnerList = giveaway.participants.length > 0 ? getRandomWinners(giveaway.participants, giveaway.winnersCount) : ['Aucun gagnant !'];

                    // Écrire les participants dans giveaway-enter.txt  
                    fs.writeFileSync('giveaway-enter.txt', giveaway.participants.join('\n'));

                    await interaction.channel.send({
                        embeds: [createEmbed('Concours Terminé', `🎉 **Concours terminé !** 🎉\n\nObjet à gagner : ${giveaway.prize}\nGagnants : ${winnerList.join(', ')}`)]
                    });

                    // Réinitialiser le fichier giveaway-enter.txt  
                    fs.truncate('giveaway-enter.txt', 0, (err) => {
                        if (err) console.error('Erreur lors de la réinitialisation du fichier :', err);
                    });

                    delete giveaways[giveawayMessage.id]; // Supprimez le giveaway de l'état  
                }
            }, duration);
            break;


        
case 'règlement':
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ embeds: [createEmbed('Erreur', 'Vous devez être un administrateur pour utiliser cette commande.', 0xff0000)], ephemeral: true });
        return;
    }

    await interaction.deferReply();

    const ruleContent = options.getString('content').replace(/\\n/g, '\n');
    const roleToAssign = options.getRole('role');

    // Envoyer le règlement
    const ruleEmbed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('Règlement')
        .setDescription(ruleContent)
        .setFooter({ text: 'Réagissez avec ✅ pour accepter le règlement' })
        .setTimestamp();

    const ruleMessage = await interaction.channel.send({ 
        embeds: [ruleEmbed]
    });

    // Ajouter une réaction pour obtenir le rôle
    await ruleMessage.react('✅');

    // Enregistrer l'ID du message et le rôle
    giveaways[ruleMessage.id] = {
        participants: [],
        role: {
            id: roleToAssign.id,
            name: roleToAssign.name
        }
    };

    console.log(`Règlement créé avec le rôle ${roleToAssign.name} (${roleToAssign.id})`);

    await interaction.editReply({ embeds: [createEmbed('Succès', 'Le règlement a été envoyé avec succès.')] });
    break;
  } // Fermeture du switch
}); // Fermeture du client.on(Events.InteractionCreate)


// Handling message reaction for regulations  
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Erreur lors de la récupération de la réaction:', error);
            return;
        }
    }
    if (user.bot) return; // Ignore bot reactions  

    // Gestion des réactions pour les giveaways
    if (reaction.emoji.name === '🎉' && giveaways[reaction.message.id]) {
        const giveaway = giveaways[reaction.message.id];
        const member = reaction.message.guild.members.cache.get(user.id);
        
        if (!giveaway.participants.includes(user.id)) {
            giveaway.participants.push(user.id);
            fs.appendFileSync('giveaway-enter.txt', `${user.id}\n`);
            
            await reaction.message.channel.send({ 
                embeds: [createEmbed('Participation', `<@${user.id}> a participé au concours pour le prix : ${giveaway.prize}`)] 
            }).then(msg => {
                setTimeout(() => msg.delete(), 5000);
            });
        }
    }

    // Gestion des réactions pour le règlement
    if (reaction.emoji.name === '✅' && giveaways[reaction.message.id]) {
        try {
            const member = await reaction.message.guild.members.fetch(user.id);
            const giveawayData = giveaways[reaction.message.id];

            if (!member) {
                console.error('Membre non trouvé');
                return;
            }

            if (!giveawayData || !giveawayData.role) {
                console.error('Données de rôle non trouvées');
                return;
            }

            // Récupérer le rôle
            const role = await reaction.message.guild.roles.fetch(giveawayData.role.id);
            
            if (!role) {
                console.error('Rôle non trouvé');
                return;
            }

            // Vérifier si le membre n'a pas déjà le rôle
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                
                // Message de confirmation
                await reaction.message.channel.send({ 
                    embeds: [createEmbed('Règlement accepté', `<@${user.id}> a accepté le règlement et reçu le rôle ${role.name}`)]
                }).then(msg => {
                    setTimeout(() => msg.delete(), 5000);
                });

                console.log(`Rôle ${role.name} attribué à ${member.user.tag}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'attribution du rôle:', error);
        }
    }
});


// Fonction pour obtenir un nombre aléatoire de gagnants  
function getRandomWinners(participants, count) {
    const shuffled = participants.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(userId => `<@${userId}>`);
}

// Function to add XP and update levels  
function addXP(userID, xpToAdd, channel) {
    if (!levels[userID]) {
        levels[userID] = { xp: 0, level: 1 };
    }
    levels[userID].xp += xpToAdd;
    let xpNeeded = levels[userID].level * 100;
    
    if (levels[userID].xp >= xpNeeded) {
        levels[userID].level++;
        levels[userID].xp = 0;
        
        // Envoyer un message de niveau supérieur
        if (channel) {
            channel.send({ 
                embeds: [createEmbed('Niveau Supérieur!', `<@${userID}> est maintenant niveau ${levels[userID].level}!`)]
            });
        }
    }
    // Sauvegarder les niveaux dans le fichier
    fs.writeFileSync('./levels.json', JSON.stringify(levels, null, 2));
}
// Function to get the leaderboard  
function getLeaderboard() {
    let leaderboard = Object.entries(levels).map(([id, data]) => {
        const member = client.users.cache.get(id);
        return { id, username: member ? member.username : 'Utilisateur inconnu', ...data };
    }).sort((a, b) => {
        if (b.level === a.level) {
            return b.xp - a.xp;
        }
        return b.level - a.level;
    }).slice(0, 10);
    return leaderboard;
}

// Save levels data on exit  
process.on('exit', () => {
    fs.writeFileSync('./levels.json', JSON.stringify(levels, null, 2));
});

// Log in to Discord with your client's token  
client.login(token);