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
 - Fichiers JSON pour les données persistantes : `niveaux.json`, `config_economie.json`, `anniversaires.json`, `concours.json`, `reglements.json`, `multiplicateurs_xp.json`, `salonAnnonceNiveau.json`, `économie.json`, `roles.json`.

## Utilisation
Lancer le bot avec `node index.js` depuis le dossier combined.

## Commandes Principales
Voici la liste complète des commandes slash disponibles :

### Utilitaires
- `/latence` : Affiche la latence du bot.
- `/espionner` : Affiche le dernier message supprimé (admins seulement).

### Modération
- `/envoyer-embed` : Envoie un message dans un embed personnalisé (titre et message requis).
- `/bannir` : Bannit un utilisateur (utilisateur et raison optionnelle, admin requis).
- `/muter` : Mute un utilisateur (utilisateur, durée en minutes, raison optionnelle, admin requis).
- `/demuter` : Unmute un utilisateur (utilisateur, admin requis).
- `/envoyer-message` : Envoie un message sous le nom du bot (message requis, admin requis).
- `/salon-nettoyer` : Supprime tous les messages dans le salon actuel (admin requis).

### Économie
- `/config-economie` : Configure les montants de l'économie (quotidien et mensuel, admin requis).
- `/quotidien` : Réclamez votre récompense quotidienne.
- `/mensuel` : Réclamez votre récompense mensuelle.
- `/boutique` : Affiche la boutique du serveur.
- `/acheter` : Achetez un article par son index (index requis).
- `/config-boutique` : Ajoute un article en boutique (rôle, prix, nom optionnel, admin requis).

### Niveaux
- `/niveau` : Affiche votre niveau.
- `/classement` : Affiche le classement des niveaux.
- `/role-niveau` : Définit un rôle pour un niveau spécifique (niveau et rôle, admin requis).
- `/definir-salon-niveau` : Définir le salon pour les annonces de passage de niveau (salon, admin requis).
- `/definir-multiplicateur-xp` : Définir le multiplicateur d'XP pour un rôle (rôle et multiplicateur ≥1, admin requis).

### Anniversaires
- `/anniversaire-set` : Enregistrer votre date d'anniversaire (format `JJ/MM` ou `JJ/MM/AAAA`).
- `/anniversaire-remove` : Supprimer votre anniversaire enregistré.
- `/anniversaire-prochain` : Affiche le prochain anniversaire enregistré sur le serveur.
- `/config-anniv-salon` : Configurer le salon d'annonces d'anniversaire (admin requis).

### Gestion Utilisateurs (Admin uniquement)
- `/ajouter-argent` : Ajouter de l'argent à un utilisateur (utilisateur et montant).
- `/retirer-argent` : Retirer de l'argent à un utilisateur (utilisateur et montant).
- `/ajouter-xp` : Ajouter de l'XP à un utilisateur (utilisateur et montant).
- `/retirer-xp` : Retirer de l'XP à un utilisateur (utilisateur et montant).
- `/definir-niveau` : Définir le niveau d'un utilisateur (utilisateur et niveau ≥1).

### Gestion Globale (Admin uniquement)
- `/ajouter-argent-global` : Ajouter de l'argent à tous les utilisateurs (montant).
- `/ajouter-xp-global` : Ajouter de l'XP à tous les utilisateurs (montant).
- `/retirer-argent-global` : Retirer de l'argent à tous les utilisateurs (montant).
- `/retirer-xp-global` : Retirer de l'XP à tous les utilisateurs (montant).

### Autres
- `/concours` : Créez un concours (prix, gagnants, durée en minutes, admin requis).
- `/reglement` : Créez un règlement pour le serveur (contenu et rôle, admin requis).
- `/ticket-creer` : Créer un ticket pour les demandes d'assistance.

## Structure
- `index.js` : Code principal du bot.
- Dossiers pour les données JSON.

## Licence
ISC
