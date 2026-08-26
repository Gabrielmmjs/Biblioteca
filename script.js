// ==========================================================================
// BIBLIOTECA VIRTUALIF - LÓGICA DE NEGÓCIO E CACHE LOCAL
// ==========================================================================

// Elementos da Interface Principal
const searchForm = document.getElementById("searchForm");
const inputLivro = document.getElementById("livro");
const buttonBusca = document.getElementById("btBuscar");
const booksGrid = document.getElementById("booksGrid");
const sectionTitle = document.getElementById("sectionTitle");
const sectionSubtitle = document.getElementById("sectionSubtitle");
const resultsCacheBadge = document.getElementById("resultsCacheBadge");

// Elementos de Progresso e Alerta
const progressContainer = document.getElementById("progressContainer");
const progressBarFill = document.getElementById("progressBarFill");
const progressPercentage = document.getElementById("progressPercentage");
const progressStatusText = document.getElementById("progressStatusText");
const errorBox = document.getElementById("errorBox");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");
const btFecharErro = document.getElementById("btFecharErro");

// Elementos de Cache
const cacheBar = document.getElementById("cacheBar");
const cacheInfoText = document.getElementById("cacheInfoText");
const btLimparCache = document.getElementById("btLimparCache");

// Modais
const apiModal = document.getElementById("apiModal");
const btConfigKey = document.getElementById("btConfigKey");
const btFecharModal = document.getElementById("btFecharModal");
const btSalvarChave = document.getElementById("btSalvarChave");
const btRemoverChave = document.getElementById("btRemoverChave");
const apiKeyInput = document.getElementById("apiKeyInput");
const keyStatusBadge = document.getElementById("keyStatusBadge");
const btToggleKeyVisibility = document.getElementById("btToggleKeyVisibility");

const bookDetailModal = document.getElementById("bookDetailModal");
const btFecharDetailModal = document.getElementById("btFecharDetailModal");
const detailModalBody = document.getElementById("detailModalBody");

// Elementos da Navegação
const navLinks = document.querySelectorAll(".nav-link");
const favCounterBadge = document.getElementById("favCounterBadge");
const categoryCards = document.querySelectorAll(".category-card");
const brandLogo = document.getElementById("brandLogo");

// Estado da Aplicação
const LOCAL_CACHE = new Map(); // Dicionário em memória para Cache Local
let livrosAtuais = [];
let apiKey = localStorage.getItem("google_books_api_key") || "";
let favoritos = JSON.parse(localStorage.getItem("virtualif_favorites")) || [];

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    atualizarBadgeApiKey();
    atualizarInfoCache();
    atualizarBadgeFavoritos();

    // Carregar acervo inicial de destaques
    buscarLivros("Tecnologia e Ciência", "📚 Destaques do Acervo", "Livros selecionados para explorar agora");
});

// Event Listeners Principais
searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const termo = inputLivro.value.trim();
    if (termo) {
        buscarLivros(termo, `🔍 Resultados para "${termo}"`, `Encontrados no catálogo da biblioteca`);
        rolarParaGrelha();
    } else {
        exibirErro("Campo Obrigatório", "Por favor, digite o nome de um livro, autor ou assunto.");
        inputLivro.focus();
    }
});

btFecharErro.addEventListener("click", ocultarErro);
btLimparCache.addEventListener("click", limparCacheLocal);
brandLogo.addEventListener("click", () => {
    navegarParaAba("inicio");
    buscarLivros("Tecnologia e Ciência", "📚 Destaques do Acervo", "Livros selecionados para explorar agora");
});

// Navegação por Categorias
categoryCards.forEach(card => {
    card.addEventListener("click", () => {
        const categoria = card.getAttribute("data-category");
        buscarLivros(categoria, `🏷️ Categoria: ${categoria}`, `Obras populares do gênero ${categoria}`);
        rolarParaGrelha();
    });
});

// Links do Header (Navegação por Abas)
navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
        const targetId = link.getAttribute("id");
        navLinks.forEach(l => l.classList.remove("active"));
        link.classList.add("active");

        if (targetId === "navFavoritos") {
            e.preventDefault();
            exibirFavoritos();
            rolarParaGrelha();
        } else if (targetId === "navCategorias") {
            e.preventDefault();
            document.getElementById("categorias").scrollIntoView({ behavior: "smooth" });
        } else if (targetId === "navBiblioteca" || targetId === "navInicio") {
            // Scroll suave
        }
    });
});

// Event Listeners dos Modais
btConfigKey.addEventListener("click", abrirModalApiKey);
btFecharModal.addEventListener("click", fecharModalApiKey);
btSalvarChave.addEventListener("click", salvarApiKey);
btRemoverChave.addEventListener("click", removerApiKey);
btToggleKeyVisibility.addEventListener("click", alternarVisibilidadeSenha);
btFecharDetailModal.addEventListener("click", fecharModalDetalhes);

// Fechar modais ao clicar fora (backdrop)
apiModal.addEventListener("click", (e) => {
    if (e.target === apiModal) fecharModalApiKey();
});
bookDetailModal.addEventListener("click", (e) => {
    if (e.target === bookDetailModal) fecharModalDetalhes();
});

// ==========================================================================
// FUNÇÃO PRINCIPAL DE BUSCA & CACHE
// ==========================================================================

async function buscarLivros(termo, tituloSecao = "Resultados da Busca", subtituloSecao = "") {
    ocultarErro();
    const termoLimpo = termo.trim();
    const chaveNormalizada = termoLimpo.toLowerCase();

    sectionTitle.textContent = tituloSecao;
    sectionSubtitle.textContent = subtituloSecao;

    // 1. CHECAGEM NO CACHE LOCAL (Dicionário em memória)
    if (LOCAL_CACHE.has(chaveNormalizada)) {
        console.log(`[Cache Hit] Dados em memória para: "${termoLimpo}"`);
        const dadosCached = LOCAL_CACHE.get(chaveNormalizada);
        
        livrosAtuais = dadosCached;
        resultsCacheBadge.classList.remove("hidden");
        
        exibirProgresso(100, "Carregando do Cache Local...");
        setTimeout(() => {
            ocultarProgresso();
            renderizarGridLivros(livrosAtuais);
        }, 150);
        return;
    }

    resultsCacheBadge.classList.add("hidden");
    iniciarControleCarregamento();

    try {
        let url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termoLimpo)}&maxResults=20`;
        if (apiKey) {
            url += `&key=${encodeURIComponent(apiKey)}`;
        }

        atualizarProgresso(30, "Conectando ao catálogo digital...");

        const response = await fetch(url);

        atualizarProgresso(65, "Processando obras encontradas...");

        if (!response.ok) {
            if (response.status === 400) throw new Error("Chave de API ou sintaxe da consulta inválida.");
            if (response.status === 403) throw new Error("Permissão negada ou limite de requisições excedido.");
            if (response.status === 429) throw new Error("Muitas consultas simultâneas. Aguarde um instante.");
            throw new Error(`Erro no servidor Google Books (Status ${response.status}).`);
        }

        const data = await response.json();

        atualizarProgresso(90, "Organizando biblioteca...");

        if (!data.items || data.items.length === 0) {
            throw new Error(`Nenhum livro encontrado para "${termoLimpo}". Tente outro termo ou categoria.`);
        }

        // Armazenar no Cache Local em Memória
        LOCAL_CACHE.set(chaveNormalizada, data.items);
        atualizarInfoCache();

        livrosAtuais = data.items;
        atualizarProgresso(100, "Concluído!");

        setTimeout(() => {
            ocultarProgresso();
            renderizarGridLivros(livrosAtuais);
        }, 250);

    } catch (error) {
        console.error("Erro ao buscar livros:", error);
        ocultarProgresso();
        
        let msg = error.message;
        if (!navigator.onLine) {
            msg = "Você está sem conexão com a internet. Verifique sua rede e tente novamente.";
        }
        
        exibirErro("Falha na Consulta", msg);
        booksGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <span style="font-size: 2.5rem; display:block; margin-bottom:10px;">🔍</span>
                <p>Nenhuma obra disponível para exibição no momento.</p>
            </div>
        `;
    } finally {
        finalizarControleCarregamento();
    }
}

// ==========================================================================
// RENDERIZAÇÃO DA GRADE DE CARDS (GRID)
// ==========================================================================

function renderizarGridLivros(items) {
    booksGrid.innerHTML = "";

    if (!items || items.length === 0) {
        booksGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <p>Nenhum livro encontrado.</p>
            </div>
        `;
        return;
    }

    items.forEach((item, index) => {
        const info = item.volumeInfo || {};
        const isFav = eFavorito(item.id);
        const thumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
        const coverSrc = thumbnail ? thumbnail.replace("http:", "https:") : null;

        // Calcular avaliação ou simular score aleatório coerente baseado no ID para visual atraente
        const rating = info.averageRating || ((item.id.charCodeAt(0) % 15) / 10 + 3.5).toFixed(1);
        const ratingStars = "⭐".repeat(Math.round(rating));

        const card = document.createElement("div");
        card.className = "book-card glass-card";
        card.innerHTML = `
            <div class="book-card-top">
                ${coverSrc 
                    ? `<img src="${coverSrc}" alt="Capa de ${escapeHTML(info.title)}" class="book-card-img" loading="lazy">`
                    : `<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">Sem Capa</div>`
                }
                <button class="book-fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}" title="${isFav ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}">
                    ${isFav ? '❤️' : '🤍'}
                </button>
            </div>
            <div class="book-card-info">
                <span class="book-tag-category">${escapeHTML(info.categories?.[0] || "Literatura")}</span>
                <h3 class="book-card-title">${escapeHTML(info.title || "Título Desconhecido")}</h3>
                <span class="book-card-author">${escapeHTML(info.authors?.join(", ") || "Autor Não Informado")}</span>
                <div class="book-card-rating">
                    <span>${ratingStars}</span>
                    <span class="book-rating-score">(${rating})</span>
                </div>
                <button class="glass-btn icon-btn btn-detalhes" data-index="${index}">
                    Ver detalhes
                </button>
            </div>
        `;

        // Event listener para abrir modal de detalhes
        card.querySelector(".btn-detalhes").addEventListener("click", () => {
            abrirModalDetalhes(item);
        });

        // Event listener para favoritar
        card.querySelector(".book-fav-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFavorito(item);
            const btn = card.querySelector(".book-fav-btn");
            const agoraFav = eFavorito(item.id);
            btn.classList.toggle("active", agoraFav);
            btn.innerHTML = agoraFav ? '❤️' : '🤍';
        });

        booksGrid.appendChild(card);
    });
}

// ==========================================================================
// MODAL DE DETALHES COMPLETO
// ==========================================================================

function abrirModalDetalhes(item) {
    const info = item.volumeInfo || {};
    const isFav = eFavorito(item.id);
    const thumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
    const coverSrc = thumbnail ? thumbnail.replace("http:", "https:") : null;
    const previewLink = info.previewLink || info.infoLink || "#";

    detailModalBody.innerHTML = `
        <div class="detail-modal-layout">
            <div class="detail-cover-wrapper">
                ${coverSrc 
                    ? `<img src="${coverSrc}" alt="Capa de ${escapeHTML(info.title)}" class="detail-cover-img">`
                    : `<div style="color:var(--text-muted); text-align:center;">Capa Indisponível</div>`
                }
            </div>

            <div class="detail-info-wrapper">
                <h2 class="detail-title">${escapeHTML(info.title)}</h2>
                <span class="detail-author">✍️ ${escapeHTML(info.authors?.join(", ") || "Autor não informado")}</span>
                
                <div class="detail-meta-tags">
                    <span class="meta-pill">🏷️ ${escapeHTML(info.categories?.[0] || "Geral")}</span>
                    <span class="meta-pill">🏢 ${escapeHTML(info.publisher || "Editora desconhecida")}</span>
                    <span class="meta-pill">📅 ${escapeHTML(info.publishedDate || "Data N/I")}</span>
                    <span class="meta-pill">📄 ${info.pageCount ? `${info.pageCount} págs.` : "Páginas N/I"}</span>
                </div>

                <div class="detail-description">
                    <p><strong>Sinopse:</strong></p>
                    <p>${escapeHTML(info.description || "Nenhuma sinopse disponível para este exemplar no acervo.")}</p>
                </div>

                <div class="detail-actions">
                    <a href="${previewLink}" target="_blank" rel="noopener noreferrer" class="glass-btn primary-btn">
                        📖 Ler Livro / Amostra
                    </a>
                    <button id="btModalFav" class="glass-btn ${isFav ? 'danger-btn' : ''}">
                        ${isFav ? '💔 Remover dos Favoritos' : '❤️ Adicionar aos Favoritos'}
                    </button>
                </div>
            </div>
        </div>
    `;

    const btModalFav = document.getElementById("btModalFav");
    btModalFav.addEventListener("click", () => {
        toggleFavorito(item);
        const agoraFav = eFavorito(item.id);
        btModalFav.innerHTML = agoraFav ? '💔 Remover dos Favoritos' : '❤️ Adicionar aos Favoritos';
        btModalFav.className = `glass-btn ${agoraFav ? 'danger-btn' : ''}`;
        renderizarGridLivros(livrosAtuais); // Atualiza os ícones na grid
    });

    bookDetailModal.showModal();
}

function fecharModalDetalhes() {
    bookDetailModal.close();
}

// ==========================================================================
// SISTEMA DE FAVORITOS (LOCALSTORAGE)
// ==========================================================================

function toggleFavorito(item) {
    const idx = favoritos.findIndex(f => f.id === item.id);
    if (idx >= 0) {
        favoritos.splice(idx, 1);
    } else {
        favoritos.push(item);
    }
    localStorage.setItem("virtualif_favorites", JSON.stringify(favoritos));
    atualizarBadgeFavoritos();
}

function eFavorito(id) {
    return favoritos.some(f => f.id === id);
}

function atualizarBadgeFavoritos() {
    favCounterBadge.textContent = favoritos.length;
}

function exibirFavoritos() {
    sectionTitle.textContent = "❤️ Meus Livros Favoritos";
    sectionSubtitle.textContent = `Você possui ${favoritos.length} obra(s) salva(s) nos favoritos`;
    resultsCacheBadge.classList.add("hidden");
    livrosAtuais = favoritos;
    renderizarGridLivros(favoritos);
}

// ==========================================================================
// ANIMAÇÃO DE PROGRESSO E ERROS
// ==========================================================================

function iniciarControleCarregamento() {
    buttonBusca.disabled = true;
    buttonBusca.innerHTML = `<div class="glass-spinner" style="width:16px; height:16px; border-width:2px;"></div> Buscando...`;
    progressContainer.classList.remove("hidden");
    atualizarProgresso(15, "Consultando catálogo digital...");
}

function finalizarControleCarregamento() {
    buttonBusca.disabled = false;
    buttonBusca.innerHTML = `<span>Buscar Livro</span>`;
}

function atualizarProgresso(porcentagem, statusText) {
    progressBarFill.style.width = `${porcentagem}%`;
    progressPercentage.textContent = `${porcentagem}%`;
    if (statusText) progressStatusText.textContent = statusText;
}

function exibirProgresso(porcentagem, statusText) {
    progressContainer.classList.remove("hidden");
    atualizarProgresso(porcentagem, statusText);
}

function ocultarProgresso() {
    progressContainer.classList.add("hidden");
    progressBarFill.style.width = "0%";
}

function exibirErro(titulo, mensagem) {
    errorTitle.textContent = titulo;
    errorMessage.textContent = mensagem;
    errorBox.classList.remove("hidden");
}

function ocultarErro() {
    errorBox.classList.add("hidden");
}

// ==========================================================================
// GERENCIAMENTO DE CACHE LOCAL
// ==========================================================================

function atualizarInfoCache() {
    const tamanho = LOCAL_CACHE.size;
    cacheInfoText.textContent = `⚡ Cache Local: ${tamanho} termo(s) armazenado(s) em memória`;
    if (tamanho > 0) {
        cacheBar.classList.remove("hidden");
    } else {
        cacheBar.classList.add("hidden");
    }
}

function limparCacheLocal() {
    LOCAL_CACHE.clear();
    atualizarInfoCache();
    console.log("[Cache] Dicionário em memória limpo.");
}

// ==========================================================================
// MODAL DE CHAVE DA API GOOGLE BOOKS
// ==========================================================================

function abrirModalApiKey() {
    apiKeyInput.value = apiKey;
    btRemoverChave.classList.toggle("hidden", !apiKey);
    apiModal.showModal();
}

function fecharModalApiKey() {
    apiModal.close();
}

function salvarApiKey() {
    const novaChave = apiKeyInput.value.trim();
    apiKey = novaChave;
    if (novaChave) {
        localStorage.setItem("google_books_api_key", novaChave);
    } else {
        localStorage.removeItem("google_books_api_key");
    }
    atualizarBadgeApiKey();
    fecharModalApiKey();
}

function removerApiKey() {
    apiKey = "";
    apiKeyInput.value = "";
    localStorage.removeItem("google_books_api_key");
    atualizarBadgeApiKey();
    fecharModalApiKey();
}

function atualizarBadgeApiKey() {
    if (apiKey) {
        keyStatusBadge.className = "status-dot active";
        keyStatusBadge.title = "Chave de API personalizada ativa";
    } else {
        keyStatusBadge.className = "status-dot inactive";
        keyStatusBadge.title = "Usando modo público (sem chave)";
    }
}

function alternarVisibilidadeSenha() {
    if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
        btToggleKeyVisibility.textContent = "🔒";
    } else {
        apiKeyInput.type = "password";
        btToggleKeyVisibility.textContent = "👁️";
    }
}

// ==========================================================================
// AUXILIARES
// ==========================================================================

function rolarParaGrelha() {
    document.getElementById("biblioteca").scrollIntoView({ behavior: "smooth" });
}

function navegarParaAba(abaId) {
    navLinks.forEach(l => l.classList.remove("active"));
    const link = document.getElementById(`nav${abaId.charAt(0).toUpperCase() + abaId.slice(1)}`);
    if (link) link.classList.add("active");
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
