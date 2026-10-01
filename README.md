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
