# Bot Gestion et Ticket Discord

## Description
Ce projet est un bot Discord combiné qui offre des fonctionnalités de gestion de serveur, d'économie, de niveaux, de tickets d'assistance, et plus encore. Il est écrit en JavaScript avec Discord.js.

## Fonctionnalités
- **Économie** : Système de pièces avec récompenses quotidiennes et mensuelles.
- **Niveaux** : Gain d'XP par message, avec multiplicateurs par rôle.
- **Boutique** : Achat de rôles avec des pièces.
- **Concours** : Création de giveaways.
- **Règlements** : Messages de règlement avec réaction pour accepter.
- **Tickets** : Système de tickets d'assistance privés.
- **Modération** : Commandes de ban, mute, unmute, salon reset.
- **Administration** : Gestion des niveaux, argent, XP pour les utilisateurs ou globalement.

## Installation
1. Cloner le repository.
2. Aller dans le dossier `bot gestion + ticket/Bots/combined`.
3. Installer les dépendances : `npm install`.
4. Configurer `config.json` avec votre token Discord, clientId et guildId.

## Configuration
- `config.json` : Contient le token, clientId et guildId.
- Fichiers JSON pour les données persistantes : levels.json, économie.json, etc.

## Utilisation
Lancer le bot avec `node index.js` depuis le dossier combined.

## Commandes Principales
- `/latence` : Affiche la latence du bot.
- `/niveau` : Affiche votre niveau.
- `/classement` : Affiche le classement des niveaux.
- `/quotidien` : Réclame la récompense quotidienne.
- `/mensuel` : Réclame la récompense mensuelle.
- `/boutique` : Affiche la boutique.
- `/acheter` : Acheter un article.
- `/concours` : Créer un concours.
- `/reglement` : Créer un règlement.
- `/ticket-creer` : Créer un système de tickets.
- Commandes admin : `/bannir`, `/muter`, `/demuter`, `/salon-nettoyer`, etc.
- Gestion : `/ajouter-argent`, `/retirer-argent`, `/ajouter-xp`, etc.
- Configuration : `/config-economie`, `/definir-salon-niveau`, `/definir-multiplicateur-xp`.

## Structure
- `index.js` : Code principal du bot.
- Dossiers pour les données JSON.

## Licence
ISC
