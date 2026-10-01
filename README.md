# On-chain Vault

On-chain Vault est un coffre-fort local chiffré qui permet de stocker des données chiffrées sur Base.

L'application est pensée pour conserver des informations sensibles comme :

- mots de passe
- seed phrases
- notes privées
- identifiants
- informations de récupération

Les données sont chiffrées localement avant d'être écrites sur la blockchain.

Seuls des payloads chiffrés sont stockés sur Base.

L'application fonctionne entièrement en local et ne nécessite aucun VPS.

---

# Fonctionnalités

- Frontend React local
- Backend Node.js local
- Chiffrement AES-256-GCM
- Messages chiffrés stockés sur Base
- Catégories chiffrées stockées sur Base
- Interface d'écriture et de lecture
- Recherche par titre
- Filtrage par catégorie
- Pagination
- Contenu masqué par défaut
- Affichage de 2 cartes par ligne sur desktop
- Suppression logique des messages
- Suppression logique des catégories
- Architecture append-only
- Reconstruction complète du coffre depuis la blockchain
- Aucune base de données locale obligatoire
- Aucun VPS nécessaire

---

# Architecture

```text
React
localhost:3000

        |
        | HTTP local
        v

Backend Node.js
127.0.0.1:3001

        |
        | lit .env.local
        |
        | PRIVATE_KEY
        | ENCRYPTION_KEY
        |
        | AES-256-GCM
        v

Payload chiffré

        |
        | ethers.js
        v

Base

        |
        v

Smart contract OnChainVault

        |
        v

Events EntryWritten
```

Le frontend n'a jamais accès à :

```text
PRIVATE_KEY
ENCRYPTION_KEY
```

Ces valeurs ne sont accessibles que par le processus Node.js local.

---

# Format des données

Avant chiffrement, un message ressemble à ceci :

```json
{
  "version": 1,
  "type": "message",
  "id": "uuid",
  "title": "GitHub",
  "categoryId": "uuid-category",
  "content": "mon-secret",
  "createdAt": "2026-10-01T12:00:00.000Z"
}
```

Une catégorie ressemble à ceci :

```json
{
  "version": 1,
  "type": "category",
  "id": "uuid",
  "name": "Mots de passe",
  "createdAt": "2026-10-01T12:00:00.000Z"
}
```

L'objet complet est chiffré avant d'être envoyé sur Base.

La blockchain ne reçoit que le payload chiffré.

---

# Chiffrement

On-chain Vault utilise :

```text
AES-256-GCM
```

AES-GCM fournit :

- confidentialité
- intégrité
- authentification

La clé de chiffrement est stockée localement dans :

```text
.env.local
```

La clé n'est jamais envoyée au frontend et n'est jamais écrite sur la blockchain.

Si la clé de chiffrement est perdue, les données chiffrées ne pourront plus être récupérées.

Il est donc indispensable de la sauvegarder dans un endroit sûr.

---

# Stockage blockchain

Le smart contract utilise des events au lieu de stocker tous les payloads directement dans le storage Solidity.

Exemple :

```solidity
event EntryWritten(
    address indexed owner,
    uint256 indexed entryId,
    bytes encryptedPayload
);
```

Chaque nouveau message, catégorie, modification ou suppression crée une nouvelle entrée chiffrée.

Le système est append-only.

---

# Pourquoi utiliser des events

L'utilisation des events permet notamment :

- de réduire le coût des écritures par rapport à du storage Solidity classique
- de conserver une architecture append-only
- de reconstruire l'historique du coffre
- de récupérer les données chiffrées à partir des logs blockchain

Les events sont récupérés via :

```text
eth_getLogs
```

Le RPC public Base limite la taille des plages de lecture.

L'application lit donc les events par lots de :

```text
1000 blocs
```

---

# Bloc de déploiement

Pour éviter de scanner la blockchain depuis le bloc 0, l'application utilise :

```env
CONTRACT_DEPLOY_BLOCK=...
```

Cette valeur correspond au bloc dans lequel le smart contract a été déployé.

Lors de la lecture, le backend commence directement à ce bloc.

Exemple :

```env
CONTRACT_DEPLOY_BLOCK=47545842
```

---

# Modifications et suppressions

Les données présentes sur une blockchain ne peuvent pas réellement être supprimées.

On-chain Vault utilise donc des événements chiffrés supplémentaires :

```text
message
message-update
message-delete

category
category-update
category-delete
```

Le backend relit les événements dans l'ordre et reconstruit l'état actuel du coffre.

Exemple :

```text
message
   |
   v
message-update
   |
   v
message-delete
```

Le message d'origine continue d'exister sous forme chiffrée sur Base, mais l'application le considère comme supprimé.

---

# Prérequis

Installe :

- Node.js
- npm
- Git

Version recommandée :

```text
Node.js 20+
```

Tu as également besoin de :

- un wallet Ethereum dédié
- de l'ETH Base Sepolia pour les tests
- un accès à un RPC Base

---

# Installation

## 1. Cloner le dépôt

```bash
git clone https://github.com/LucasChaffanjon/On-chain-writting.git
```

Puis :

```bash
cd On-chain-writting
```

---

## 2. Installer les dépendances

```bash
npm install
```

---

# Configuration

## 3. Créer `.env.local`

Le dépôt contient un fichier :

```text
.env.example
```

Crée ta configuration locale :

```bash
cp .env.example .env.local
```

Le fichier `.env.local` doit ressembler à ceci :

```env
NETWORK=base-sepolia

RPC_URL=https://sepolia.base.org

PRIVATE_KEY=0xYOUR_PRIVATE_KEY

CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS

CONTRACT_DEPLOY_BLOCK=YOUR_DEPLOYMENT_BLOCK

ENCRYPTION_KEY=YOUR_BASE64_ENCRYPTION_KEY

SERVER_PORT=3001
```

Ne commit jamais :

```text
.env.local
```

Ce fichier est ignoré par `.gitignore`.

---

# Wallet

## 4. Créer un wallet dédié

Il est recommandé d'utiliser un wallet dédié uniquement à cette application.

N'utilise pas un wallet contenant des fonds importants.

Lance :

```bash
npm run wallet:create
```

La commande affiche :

```text
Address:
0x...

Private key:
0x...
```

Copie la clé privée dans `.env.local` :

```env
PRIVATE_KEY=0x...
```

Ne partage jamais cette clé.

---

# Approvisionner le wallet

## 5. Ajouter de l'ETH Base Sepolia

Le wallet a besoin d'ETH Base Sepolia pour :

- déployer le contrat
- écrire des messages
- créer des catégories
- enregistrer des modifications
- enregistrer des suppressions

Envoie de l'ETH Base Sepolia à l'adresse générée à l'étape précédente.

Une fois le backend lancé, tu peux vérifier le solde ici :

```text
http://127.0.0.1:3001/api/wallet
```

---

# Clé de chiffrement

## 6. Générer une clé de chiffrement

Lance :

```bash
npm run encryption-key:create
```

La commande affiche une ligne du type :

```text
ENCRYPTION_KEY=...
```

Copie la valeur complète dans `.env.local` :

```env
ENCRYPTION_KEY=...
```

Important :

```text
Ne perds pas cette clé.
```

Sans cette clé, les données présentes sur la blockchain ne pourront plus être déchiffrées.

Sauvegarde-la dans un endroit sûr, idéalement hors ligne.

---

# Smart contract

## 7. Compiler le contrat

Lance :

```bash
npm run contract:compile
```

Cela génère :

```text
artifacts/OnChainVault.json
```

Ce fichier contient notamment :

- l'ABI
- le bytecode
- le deployed bytecode
- les informations nécessaires pour interagir avec le contrat

Il ne contient aucune donnée sensible.

---

## 8. Déployer le contrat

Assure-toi que ton wallet possède de l'ETH Base Sepolia.

Puis lance :

```bash
npm run contract:deploy
```

Le script affiche notamment :

```text
Contract address: 0x...
Deployment block: ...
```

Copie les deux valeurs dans `.env.local` :

```env
CONTRACT_ADDRESS=0x...
CONTRACT_DEPLOY_BLOCK=...
```

Exemple :

```env
CONTRACT_ADDRESS=0x123456789...
CONTRACT_DEPLOY_BLOCK=47545842
```

Ne copie pas les valeurs d'exemple.

Le bloc de déploiement permet d'éviter de scanner Base depuis le bloc 0.

---

## 9. Vérifier le contrat

Lance :

```bash
npm run contract:check
```

Résultat attendu :

```text
Contract detected.
Maximum payload: 8192 bytes
```

---

# Lancer l'application

L'application utilise deux processus :

```text
Backend Node.js
+
Frontend React
```

## 10. Lancer le backend

Dans un premier terminal :

```bash
npm run server
```

Tu dois voir quelque chose comme :

```text
==========================================
 On-chain Vault local API
==========================================

URL: http://127.0.0.1:3001
Wallet: 0x...
Contract: 0x...
Deploy block: ...
```

---

## 11. Lancer le frontend

Dans un second terminal :

```bash
npm start
```

Puis ouvre :

```text
http://localhost:3000
```

---

# Utilisation

L'interface contient trois sections principales :

```text
Écrire
Lire
Catégories
```

---

# Catégories

Va dans :

```text
Catégories
```

Tu peux créer par exemple :

```text
Mots de passe
Seed phrases
Notes
Récupération
Identité
```

Les catégories sont elles aussi chiffrées avant d'être écrites sur Base.

---

# Écrire un message

Va dans :

```text
Écrire
```

Renseigne :

```text
Titre
Catégorie
Contenu
```

Exemple :

```text
Titre :
GitHub

Catégorie :
Mots de passe

Contenu :
mot-de-passe-exemple
```

Clique sur :

```text
Chiffrer et enregistrer
```

Le backend :

1. construit l'objet du message
2. chiffre l'objet avec AES-256-GCM
3. signe la transaction avec le wallet local
4. écrit le payload chiffré sur Base
5. attend la confirmation de la transaction

---

# Lire les messages

Va dans :

```text
Lire
```

Les messages sont affichés sous forme de cartes.

Sur desktop :

```text
2 cartes par ligne
```

L'application affiche au maximum :

```text
10 messages par page
```

Le contenu est masqué par défaut :

```text
••••••••••••••
```

Clique sur :

```text
Voir
```

pour révéler le contenu.

Clique sur :

```text
Masquer
```

pour le cacher à nouveau.

Clique sur :

```text
Copier
```

pour copier le contenu dans le presse-papiers.

---

# Recherche

La section `Lire` contient une barre de recherche :

```text
Rechercher par nom...
```

La recherche s'effectue sur le titre des messages.

Exemple :

```text
GitHub
```

affichera uniquement les messages dont le titre contient `GitHub`.

---

# Filtres

Les catégories peuvent être utilisées comme filtres.

Exemple :

```text
Tous
Mots de passe
Seed phrases
Notes
```

Cliquer sur une catégorie affiche uniquement les messages associés.

---

# Pagination

L'application affiche au maximum :

```text
10 messages par page
```

Lorsque plusieurs pages existent :

```text
Précédent
Page 1 / 3
Suivant
```

La pagination est recalculée après :

- une recherche
- un changement de catégorie
- une suppression
- une actualisation

---

# Suppression d'un message

Clique sur :

```text
Supprimer
```

Une confirmation est demandée.

Le message n'est pas réellement détruit sur la blockchain.

L'application écrit une nouvelle entrée chiffrée :

```text
message-delete
```

Lors de la reconstruction du coffre, ce message est ensuite ignoré.

---

# Suppression d'une catégorie

Une catégorie peut être supprimée uniquement si elle ne contient aucun message actif.

Si elle contient encore des messages, l'application refuse la suppression.

Il faut d'abord :

- supprimer les messages concernés
- ou les déplacer vers une autre catégorie

La suppression crée une entrée chiffrée :

```text
category-delete
```

---

# Outils de debug

Les scripts de debug sont dans :

```text
server/debug/
```

Ils ne sont pas nécessaires pour utiliser normalement l'application.

---

## Écrire une entrée de test

```bash
npm run vault:write-test
```

Ce script écrit un faux message chiffré sur Base Sepolia.

N'utilise jamais un vrai mot de passe ou une vraie seed phrase dans le script de debug.

---

## Lire les entrées de test

```bash
npm run vault:read-test
```

Le script :

1. démarre au bloc `CONTRACT_DEPLOY_BLOCK`
2. lit les logs blockchain par lots
3. récupère les payloads chiffrés
4. les déchiffre
5. affiche les données dans le terminal

Le RPC public de Base limite la plage de lecture de `eth_getLogs`.

L'application utilise donc des lots de :

```text
1000 blocs
```

---

# Restaurer le coffre sur un autre ordinateur

L'un des objectifs principaux du projet est de pouvoir reconstruire entièrement le coffre sans dépendre d'une base de données locale.

Sur un nouvel ordinateur :

## 1. Cloner le dépôt

```bash
git clone https://github.com/LucasChaffanjon/On-chain-writting.git
```

Puis :

```bash
cd On-chain-writting
```

---

## 2. Installer les dépendances

```bash
npm install
```

---

## 3. Créer `.env.local`

```bash
cp .env.example .env.local
```

Tu dois ensuite remettre tes vraies valeurs :

```env
NETWORK=base-sepolia

RPC_URL=https://sepolia.base.org

PRIVATE_KEY=0x...

CONTRACT_ADDRESS=0x...

CONTRACT_DEPLOY_BLOCK=...

ENCRYPTION_KEY=...

SERVER_PORT=3001
```

---

## 4. Lancer le backend

```bash
npm run server
```

---

## 5. Lancer le frontend

```bash
npm start
```

L'application va alors :

```text
CONTRACT_DEPLOY_BLOCK
        |
        v
lecture des EntryWritten
        |
        v
récupération des payloads
        |
        v
déchiffrement AES-256-GCM
        |
        v
rejeu des créations
        |
        v
rejeu des modifications
        |
        v
rejeu des suppressions
        |
        v
reconstruction du coffre
```

Aucune base de données locale n'est nécessaire.

---

# Ce qu'il faut sauvegarder

Pour pouvoir restaurer le coffre, conserve dans un endroit sécurisé :

```text
PRIVATE_KEY
ENCRYPTION_KEY
CONTRACT_ADDRESS
CONTRACT_DEPLOY_BLOCK
```

La clé la plus importante pour déchiffrer les données est :

```text
ENCRYPTION_KEY
```

Sans elle, les données on-chain restent chiffrées.

La clé privée permet notamment de continuer à signer de nouvelles transactions depuis le même wallet.

---

# Sécurité

## Ne jamais commit `.env.local`

Les fichiers sensibles doivent rester ignorés par Git :

```text
.env
.env.local
.env.*.local
```

Avant de publier sur GitHub, vérifie :

```bash
git check-ignore .env.local
```

Résultat attendu :

```text
.env.local
```

Vérifie également que `.env.local` n'est pas suivi :

```bash
git ls-files .env.local
```

Cette commande ne doit rien retourner.

---

## Vérifier les fichiers avant publication

Tu peux rechercher d'éventuelles valeurs sensibles avec :

```bash
grep -Rni \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude=.env.local \
  -E "PRIVATE_KEY|ENCRYPTION_KEY|seed phrase|0x[0-9a-fA-F]{64}" .
```

Les références comme :

```js
process.env.PRIVATE_KEY
```

ou :

```js
process.env.ENCRYPTION_KEY
```

sont normales.

En revanche, aucune vraie valeur de clé privée ou de clé de chiffrement ne doit apparaître dans les fichiers suivis par Git.

---

# Ne pas utiliser un wallet principal

Il est fortement recommandé d'utiliser un wallet dédié à cette application.

Ne conserve pas de fonds importants dessus.

---

# Ne jamais exposer la clé privée au frontend

N'utilise jamais :

```env
REACT_APP_PRIVATE_KEY=...
```

Les variables `REACT_APP_*` peuvent être intégrées au bundle JavaScript du frontend.

La clé privée doit rester dans :

```text
.env.local
```

et être utilisée uniquement par le backend Node.js.

---

# Ne jamais exposer la clé de chiffrement au frontend

Même principe pour :

```text
ENCRYPTION_KEY
```

Elle doit rester uniquement côté Node.js.

---

# Métadonnées publiques

Même si le contenu est chiffré, une blockchain publique révèle certaines métadonnées.

Il est notamment possible de voir :

- l'adresse du wallet
- l'adresse du contrat
- les hashes de transaction
- les blocs utilisés
- les timestamps approximatifs
- la fréquence des transactions
- la taille approximative des payloads

Le contenu lui-même reste chiffré.

---

# Avertissement concernant les seed phrases

Stocker une seed phrase sur une blockchain publique, même sous forme chiffrée, présente un risque particulier.

Le ciphertext restera publiquement disponible de manière permanente.

Si la clé de chiffrement est compromise dans le futur, les anciens payloads pourront potentiellement être déchiffrés.

Pour les données critiques, il est recommandé de conserver également une sauvegarde hors ligne.

Ne considère pas ce projet comme l'unique sauvegarde d'une seed phrase importante.

---

# `.env.example`

Le dépôt contient un fichier `.env.example`.

Exemple :

```env
NETWORK=base-sepolia

RPC_URL=https://sepolia.base.org

PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS_HERE

CONTRACT_DEPLOY_BLOCK=YOUR_DEPLOYMENT_BLOCK

ENCRYPTION_KEY=YOUR_BASE64_ENCRYPTION_KEY_HERE

SERVER_PORT=3001
```

Pour créer la configuration locale :

```bash
cp .env.example .env.local
```

Puis remplace les valeurs d'exemple par les tiennes.

---

# Commandes disponibles

Installer les dépendances :

```bash
npm install
```

Lancer le frontend :

```bash
npm start
```

Lancer le backend :

```bash
npm run server
```

Créer un wallet dédié :

```bash
npm run wallet:create
```

Créer une clé AES-256 :

```bash
npm run encryption-key:create
```

Compiler le smart contract :

```bash
npm run contract:compile
```

Déployer le smart contract :

```bash
npm run contract:deploy
```

Vérifier le contrat :

```bash
npm run contract:check
```

Écrire une entrée de test :

```bash
npm run vault:write-test
```

Lire et déchiffrer les entrées de test :

```bash
npm run vault:read-test
```

Créer un build du frontend :

```bash
npm run build
```

---

# Structure du projet

```text
On-chain-writting/
├── artifacts/
│   └── OnChainVault.json
│
├── contracts/
│   └── OnChainVault.sol
│
├── server/
│   ├── debug/
│   │   ├── read-test.js
│   │   └── write-test.js
│   │
│   ├── check-contract.js
│   ├── compile-contract.js
│   ├── create-encryption-key.js
│   ├── create-wallet.js
│   ├── crypto.js
│   ├── deploy-contract.js
│   └── index.js
│
├── src/
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

# Réseau actuel

Le projet est actuellement prévu pour :

```text
Base Sepolia
Chain ID : 84532
```

Il est recommandé de tester entièrement le projet sur Base Sepolia avant de passer sur Base Mainnet.

---

# Publication sur GitHub

Avant de commit :

```bash
git status
```

Vérifie que `.env.local` n'apparaît pas.

Puis :

```bash
git add .
```

Vérifie une nouvelle fois :

```bash
git status
```

Puis crée le commit :

```bash
git commit -m "Build encrypted on-chain vault on Base"
```

Enfin :

```bash
git push
```

Ou, si nécessaire :

```bash
git push -u origin main
```

---

# Licence

MIT
