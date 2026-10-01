import { useCallback, useEffect, useMemo, useState } from "react";

import "./App.css";

const API_URL = "http://127.0.0.1:3001";

const MESSAGES_PER_PAGE = 10;

function App() {
  const [activeTab, setActiveTab] = useState("write");

  const [categories, setCategories] = useState([]);

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [wallet, setWallet] = useState(null);

  // ==================================================
  // Message form
  // ==================================================

  const [title, setTitle] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("");

  const [content, setContent] = useState("");

  const [writingMessage, setWritingMessage] = useState(false);

  // ==================================================
  // Category form
  // ==================================================

  const [newCategoryName, setNewCategoryName] = useState("");

  const [writingCategory, setWritingCategory] = useState(false);

  // ==================================================
  // Read filters
  // ==================================================

  const [categoryFilter, setCategoryFilter] = useState("all");

  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [visibleMessages, setVisibleMessages] = useState(new Set());

  const [deletingMessageId, setDeletingMessageId] = useState(null);

  const [deletingCategoryId, setDeletingCategoryId] = useState(null);

  // ==================================================
  // Wallet
  // ==================================================

  const loadWallet = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/wallet`);

      const data = await response.json();

      if (data.success) {
        setWallet(data);
      }
    } catch {
      // Wallet display is optional.
    }
  }, []);

  // ==================================================
  // Vault
  // ==================================================

  const loadVault = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/vault`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load vault");
      }

      const loadedCategories = data.categories || [];

      const loadedMessages = data.messages || [];

      setCategories(loadedCategories);

      setMessages(loadedMessages);

      setSelectedCategory((current) => {
        const exists = loadedCategories.some(
          (category) => category.id === current
        );

        if (exists) {
          return current;
        }

        if (loadedCategories.length > 0) {
          return loadedCategories[0].id;
        }

        return "";
      });

      setCategoryFilter((current) => {
        if (current === "all") {
          return "all";
        }

        const exists = loadedCategories.some(
          (category) => category.id === current
        );

        return exists ? current : "all";
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================================================
  // Initial load
  // ==================================================

  useEffect(() => {
    loadVault();
    loadWallet();
  }, [loadVault, loadWallet]);

  // ==================================================
  // Category map
  // ==================================================

  const categoryMap = useMemo(() => {
    const map = {};

    for (const category of categories) {
      map[category.id] = category.name;
    }

    return map;
  }, [categories]);

  // ==================================================
  // Filtered messages
  // ==================================================

  const filteredMessages = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...messages].reverse().filter((message) => {
      const matchesCategory =
        categoryFilter === "all" || message.categoryId === categoryFilter;

      const matchesSearch =
        !normalizedSearch ||
        String(message.title || "")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [messages, categoryFilter, searchQuery]);

  // ==================================================
  // Pagination
  // ==================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE)
  );

  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * MESSAGES_PER_PAGE;

    return filteredMessages.slice(start, start + MESSAGES_PER_PAGE);
  }, [filteredMessages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ==================================================
  // Write message
  // ==================================================

  async function handleWriteMessage(event) {
    event.preventDefault();

    if (!title.trim() || !selectedCategory || !content) {
      setError("Tous les champs sont obligatoires.");

      return;
    }

    try {
      setWritingMessage(true);
      setError("");

      const response = await fetch(`${API_URL}/api/messages`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          title,
          categoryId: selectedCategory,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to write message");
      }

      setTitle("");
      setContent("");

      await loadVault();

      setCurrentPage(1);

      setActiveTab("read");
    } catch (err) {
      setError(err.message);
    } finally {
      setWritingMessage(false);
    }
  }

  // ==================================================
  // Create category
  // ==================================================

  async function handleCreateCategory(event) {
    event.preventDefault();

    const name = newCategoryName.trim();

    if (!name) {
      return;
    }

    try {
      setWritingCategory(true);

      setError("");

      const response = await fetch(`${API_URL}/api/categories`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create category");
      }

      setNewCategoryName("");

      await loadVault();

      setSelectedCategory(data.category.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setWritingCategory(false);
    }
  }

  // ==================================================
  // Delete message
  // ==================================================

  async function handleDeleteMessage(message) {
    const confirmed = window.confirm(
      `Supprimer "${message.title}" ?\n\nCette suppression sera enregistrée sur la blockchain et le message sera masqué du coffre.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingMessageId(message.id);

      setError("");

      const response = await fetch(`${API_URL}/api/messages/${message.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de supprimer le message");
      }

      setVisibleMessages((current) => {
        const next = new Set(current);

        next.delete(message.id);

        return next;
      });

      await loadVault();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingMessageId(null);
    }
  }

  // ==================================================
  // Delete category
  // ==================================================

  async function handleDeleteCategory(category) {
    const numberOfMessages = messages.filter(
      (message) => message.categoryId === category.id
    ).length;

    if (numberOfMessages > 0) {
      setError(
        `La catégorie "${category.name}" contient ${numberOfMessages} message(s). Déplace ou supprime d'abord ces messages.`
      );

      return;
    }

    const confirmed = window.confirm(
      `Supprimer la catégorie "${category.name}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingCategoryId(category.id);

      setError("");

      const response = await fetch(`${API_URL}/api/categories/${category.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible de supprimer la catégorie");
      }

      await loadVault();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingCategoryId(null);
    }
  }

  // ==================================================
  // Reveal / hide
  // ==================================================

  function toggleMessageVisibility(messageId) {
    setVisibleMessages((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  // ==================================================
  // Copy
  // ==================================================

  async function copyMessage(messageContent) {
    try {
      await navigator.clipboard.writeText(messageContent);
    } catch {
      setError("Impossible de copier le contenu.");
    }
  }

  // ==================================================
  // UI
  // ==================================================

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Coffre fort Base</h1>

          <p>Chiffré asymétriquement en local</p>
        </div>

        {wallet && (
          <div className="wallet">
            <span>
              {wallet.address.slice(0, 6)}
              ...
              {wallet.address.slice(-4)}
            </span>

            <small>{Number(wallet.balanceEth).toFixed(5)} ETH</small>
          </div>
        )}
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "write" ? "active" : ""}
          onClick={() => setActiveTab("write")}
        >
          Écrire
        </button>

        <button
          className={activeTab === "read" ? "active" : ""}
          onClick={() => setActiveTab("read")}
        >
          Lire
        </button>

        <button
          className={activeTab === "categories" ? "active" : ""}
          onClick={() => setActiveTab("categories")}
        >
          Catégories
        </button>
      </nav>

      <main className="content">
        {error && (
          <div className="error">
            <span>{error}</span>

            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {activeTab === "write" && (
          <section>
            <h2>Nouveau message</h2>

            {categories.length === 0 ? (
              <div className="empty">
                <p>Crée d'abord une catégorie.</p>

                <button
                  className="primary"
                  onClick={() => setActiveTab("categories")}
                >
                  Créer une catégorie
                </button>
              </div>
            ) : (
              <form onSubmit={handleWriteMessage} className="form">
                <label>
                  Titre
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ex. GitHub"
                    autoComplete="off"
                  />
                </label>

                <label>
                  Catégorie
                  <select
                    value={selectedCategory}
                    onChange={(event) =>
                      setSelectedCategory(event.target.value)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Contenu
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Contenu à chiffrer..."
                    rows={10}
                  />
                </label>

                <button className="primary" disabled={writingMessage}>
                  {writingMessage
                    ? "Écriture sur Base..."
                    : "Chiffrer et enregistrer"}
                </button>
              </form>
            )}
          </section>
        )}

        {activeTab === "read" && (
          <section>
            <div className="sectionHeader">
              <div>
                <h2>Messages</h2>

                <p className="messageCount">
                  {filteredMessages.length} résultat(s)
                </p>
              </div>

              <button
                className="secondary"
                onClick={loadVault}
                disabled={loading}
              >
                Actualiser
              </button>
            </div>

            <div className="readToolbar">
              <input
                className="searchInput"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher par nom..."
                autoComplete="off"
              />
            </div>

            <div className="filter">
              <button
                className={categoryFilter === "all" ? "active" : ""}
                onClick={() => setCategoryFilter("all")}
              >
                Tous
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  className={categoryFilter === category.id ? "active" : ""}
                  onClick={() => setCategoryFilter(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="empty">Lecture de Base...</div>
            ) : paginatedMessages.length === 0 ? (
              <div className="empty">Aucun message.</div>
            ) : (
              <>
                <div className="messageGrid">
                  {paginatedMessages.map((message) => {
                    const messageId = message.id || message.entryId;

                    const isVisible = visibleMessages.has(messageId);

                    const isDeleting = deletingMessageId === message.id;

                    return (
                      <article className="messageCard" key={messageId}>
                        <div className="messageCardHeader">
                          <div className="messageTitleBlock">
                            <span className="categoryBadge">
                              {message.legacy
                                ? message.category || "Ancien message"
                                : categoryMap[message.categoryId] ||
                                  "Sans catégorie"}
                            </span>

                            <h3>{message.title}</h3>
                          </div>

                          <span className="messageDate">
                            {message.createdAt
                              ? new Date(message.createdAt).toLocaleDateString()
                              : ""}
                          </span>
                        </div>

                        {isVisible ? (
                          <pre className="messageContent">
                            {message.content}
                          </pre>
                        ) : (
                          <div className="hiddenContent">••••••••••••••••</div>
                        )}

                        <div className="messageCardFooter">
                          <button
                            className="secondary smallButton"
                            onClick={() => toggleMessageVisibility(messageId)}
                          >
                            {isVisible ? "Masquer" : "Voir"}
                          </button>

                          <button
                            className="secondary smallButton"
                            onClick={() => copyMessage(message.content)}
                          >
                            Copier
                          </button>

                          <button
                            className="dangerButton smallButton"
                            disabled={isDeleting}
                            onClick={() => handleDeleteMessage(message)}
                          >
                            {isDeleting ? "Suppression..." : "Supprimer"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="secondary"
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                    >
                      Précédent
                    </button>

                    <span>
                      Page {currentPage} / {totalPages}
                    </span>

                    <button
                      className="secondary"
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === "categories" && (
          <section>
            <h2>Catégories</h2>

            <form className="categoryForm" onSubmit={handleCreateCategory}>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Nouvelle catégorie"
                autoComplete="off"
              />

              <button className="primary" disabled={writingCategory}>
                {writingCategory ? "Création..." : "Ajouter"}
              </button>
            </form>

            <div className="categoryList">
              {categories.map((category) => {
                const messageCount = messages.filter(
                  (message) => message.categoryId === category.id
                ).length;

                const isDeleting = deletingCategoryId === category.id;

                return (
                  <div className="categoryItem" key={category.id}>
                    <div>
                      <strong>{category.name}</strong>

                      <small>{messageCount} message(s)</small>
                    </div>

                    <button
                      className="dangerButton smallButton"
                      disabled={isDeleting}
                      onClick={() => handleDeleteCategory(category)}
                    >
                      {isDeleting ? "Suppression..." : "Supprimer"}
                    </button>
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="empty">Aucune catégorie.</div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
