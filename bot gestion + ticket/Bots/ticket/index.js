const { Client, GatewayIntentBits, REST, Routes, Events, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { token, clientId, guildId } = require('./config.json');

// Créez une instance de client  
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent  
    ]
});

// Quand le client est prêt, exécutez ce code (une seule fois)
client.once(Events.ClientReady, () => {
    console.log(`Prêt ! ${client.user.tag} est en service !`);
});

// Enregistrer la commande slash pour créer un ticket  
const commands = [
    {
        name: 'ticket-create',
        description: 'Créer un ticket pour les demandes d\'assistance.'
    }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('Début de l\'enregistrement des commandes slash...');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log('Commandes slash enregistrées avec succès.');
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des commandes:', error);
    }
})();

// Gérer les interactions  
client.on(Events.InteractionCreate, async interaction => {
    // Vérifiez si l'interaction est une commande  
    if (interaction.isCommand()) {
        const { commandName } = interaction;

        // Commande pour créer un ticket  
        if (commandName === 'ticket-create') {
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
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            try {
                // Vérifier si l'utilisateur a déjà un ticket
                const existingTicket = interaction.guild.channels.cache.find(
                    channel => channel.name === `ticket-${interaction.user.id}`
                );

                if (existingTicket) {
                    return await interaction.reply({
                        content: 'Vous avez déjà un ticket ouvert!',
                        ephemeral: true
                    });
                }

                // Créer un salon de ticket
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

                // Créer le bouton de fermeture
                const closeButton = new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder()
                    .addComponents(closeButton);

                // Message de bienvenue dans le ticket
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
    }
});

// Connectez-vous à Discord avec votre token  
client.login(token);