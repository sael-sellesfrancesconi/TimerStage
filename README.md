# Chronomètre ECOS/EPOS –

Bienvenue sur le projet **Chronomètre ECOS/EPOS** ! Cette application web permet de gérer des sessions de simulation d'ECOS avec un chronomètre dynamique, une interface et une gestion avancée des sessions.

## Fonctionnalités principales

- **Gestion des sessions** :
  - Création de sessions ECOS nationales, ECOS facultaires ou EPOS.
  - Durées personnalisables pour chaque phase (station, pause, débrief).
  - Tableau de gestion des sessions en cours (nom, admin, suppression rapide).
- **Chronomètre intelligent** :
  - Phases dynamiques selon le type de session :
    - ECOS nationales : alternance Station/Pause.
    - ECOS facultaires & EPOS : cycle Station → Pause → Débrief.
  - Affichage du temps restant, phase en cours (couleur et label adaptés).
  - Contrôles réservés à l’admin (pause, reprise, reset, suppression).
  - Spectateurs en mode lecture seule.
- **Backend robuste** :
  - API sécurisée (JWT pour l’admin).
  - WebSocket pour synchronisation temps réel.
  - Aucune donnée sensible stockée côté client.

## Installation rapide

### Prérequis
- Node.js >= 18
- npm

### 1. Cloner le dépôt
```bash
git clone https://github.com/sael-sellesfrancesconi/TimerStage
cd Timer_Stage
```

### 2. Installer les dépendances
```bash
cd server && npm install
cd ../client && npm install
```

### 3. Lancer le backend
```bash
cd ../server
npm start
```

### 4. Lancer le frontend
```bash
cd ../client
npm run dev
```

L’application sera accessible sur [cbs-timer.cbs.site.univ-lorraine.fr:3000](cbs-timer.cbs.site.univ-lorraine.fr:3000)

## Utilisation

### Connexion admin
- Identifiant par défaut : `admin1`
- Mot de passe : `azerty`

### Création d’une session
1. Se connecter en tant qu’admin.
2. Choisir le type de session (ECOS nationales, ECOS facultaires, EPOS).
3. Définir les durées souhaitées pour chaque phase.
4. Nommer la session et valider.

### Gestion du timer
- L’admin peut démarrer, mettre en pause, reprendre, réinitialiser ou supprimer la session.
- Les spectateurs voient le timer en temps réel, sans contrôle.

## Technologies utilisées
- **Frontend** : React + Vite, CSS moderne
- **Backend** : Node.js, Express, Socket.io
- **Sécurité** : JWT, CORS

## Personnalisation
- Logos dynamiques selon le type de session (Santé/Pharmacie).
- Couleurs et labels adaptés à chaque phase.

## Auteur
- Sael Selles-Francesconi


**Projet open source – N’hésitez pas à contribuer !**
