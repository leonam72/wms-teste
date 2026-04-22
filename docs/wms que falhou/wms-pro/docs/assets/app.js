(function () {
  const DOCS = window.DOCS_CONTENT || { tree: [], pages: {} };

  const navTree = document.getElementById("nav-tree");
  const searchInput = document.getElementById("search-input");
  const docBody = document.getElementById("doc-body");
  const currentTitle = document.getElementById("current-title");
  const currentPath = document.getElementById("current-path");
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");

  const openDirs = new Set();
  let currentPathKey = "";

  function friendlyName(name) {
    return name.replace(/\.md$/i, "").replace(/[-_]/g, " ");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeDocPath(input) {
    if (!input) return "";
    let candidate = decodeURIComponent(String(input).trim());
    candidate = candidate.replace(/^#/, "");
    candidate = candidate.replace(/^\.?\//, "");
    const docsMarker = "/docs/";
    const docsIndex = candidate.indexOf(docsMarker);
    if (docsIndex !== -1) {
      candidate = candidate.slice(docsIndex + docsMarker.length);
    }
    if (!candidate.endsWith(".md")) {
      return "";
    }
    return candidate;
  }

  function getPathFromHash() {
    return normalizeDocPath(window.location.hash);
  }

  function setHash(path) {
    const encoded = encodeURIComponent(path).replace(/%2F/g, "/");
    if (window.location.hash !== "#" + encoded) {
      window.location.hash = encoded;
    }
  }

  function resolveRelativePath(basePath, target) {
    const direct = normalizeDocPath(target);
    if (direct) return direct;

    let candidate = String(target || "").trim();
    if (!candidate || candidate.startsWith("http://") || candidate.startsWith("https://") || candidate.startsWith("mailto:")) {
      return "";
    }

    if (candidate.startsWith(DOCS_ROOT)) {
      return normalizeDocPath(candidate);
    }

    const baseParts = basePath.split("/");
    baseParts.pop();

    candidate.split("/").forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") {
        baseParts.pop();
        return;
      }
      baseParts.push(part);
    });

    const resolved = baseParts.join("/");
    return DOCS.pages[resolved] ? resolved : "";
  }

  function extractTitle(path, markdown) {
    const match = String(markdown || "").match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : friendlyName(path.split("/").pop());
  }

  function buildTreeData(paths) {
    const root = [];
    const dirMap = new Map();

    function ensureDir(parentChildren, dirPath, name) {
      if (!dirMap.has(dirPath)) {
        const node = { type: "dir", name, path: dirPath, children: [] };
        dirMap.set(dirPath, node);
        parentChildren.push(node);
      }
      return dirMap.get(dirPath);
    }

    paths.forEach((path) => {
      const parts = path.split("/");
      let currentChildren = root;
      let currentPath = "";

      parts.forEach((part, index) => {
        currentPath = currentPath ? currentPath + "/" + part : part;
        const isFile = index === parts.length - 1;
        if (isFile) {
          currentChildren.push({ type: "file", name: part, path });
          return;
        }
        const dirNode = ensureDir(currentChildren, currentPath, part);
        currentChildren = dirNode.children;
      });
    });

    function sortNodes(nodes) {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
      nodes.forEach((node) => node.type === "dir" && sortNodes(node.children));
    }

    sortNodes(root);
    return root;
  }

  function ensureExpandedFor(path) {
    const parts = path.split("/");
    let current = "";
    parts.slice(0, -1).forEach((part) => {
      current = current ? current + "/" + part : part;
      openDirs.add(current);
    });
  }

  function renderTree(nodes, parent, filter) {
    const list = document.createElement("ul");
    list.className = "tree-group";

    nodes.forEach((node) => {
      const item = document.createElement("li");
      item.className = "tree-node";

      if (node.type === "dir") {
        const childVisible = hasVisibleDescendant(node, filter);
        if (!childVisible) {
          item.classList.add("is-hidden");
        }

        const wrapper = document.createElement("div");
        wrapper.className = "tree-dir";
        wrapper.dataset.path = node.path;
        if (!openDirs.has(node.path) && !filter) {
          wrapper.classList.add("is-collapsed");
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "tree-dir__toggle";
        button.innerHTML = `
          <span>
            <span class="tree-dir__name">${escapeHtml(friendlyName(node.name))}</span>
            <span class="tree-dir__meta">${escapeHtml(node.path + "/")}</span>
          </span>
          <span class="tree-dir__icon">▾</span>
        `;
        if (filter && childVisible) {
          button.classList.add("is-match");
          openDirs.add(node.path);
          wrapper.classList.remove("is-collapsed");
        }
        button.addEventListener("click", () => {
          if (wrapper.classList.toggle("is-collapsed")) {
            openDirs.delete(node.path);
          } else {
            openDirs.add(node.path);
          }
        });

        const childrenContainer = document.createElement("div");
        childrenContainer.className = "tree-dir__children";
        renderTree(node.children, childrenContainer, filter);

        wrapper.appendChild(button);
        wrapper.appendChild(childrenContainer);
        item.appendChild(wrapper);
      } else {
        const matches = !filter || node.path.toLowerCase().includes(filter) || friendlyName(node.name).toLowerCase().includes(filter);
        if (!matches) {
          item.classList.add("is-hidden");
        }

        const link = document.createElement("a");
        link.href = "#" + encodeURIComponent(node.path).replace(/%2F/g, "/");
        link.className = "tree-file";
        link.dataset.path = node.path;
        if (node.path === currentPathKey) {
          link.classList.add("is-active");
        }
        link.innerHTML = `
          <span class="tree-file__name">${escapeHtml(friendlyName(node.name))}</span>
          <span class="tree-file__path">${escapeHtml(node.path)}</span>
        `;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openDocument(node.path);
          closeSidebarOnMobile();
        });
        item.appendChild(link);
      }

      list.appendChild(item);
    });

    parent.appendChild(list);
  }

  function hasVisibleDescendant(node, filter) {
    if (!filter) return true;
    return node.children.some((child) => {
      if (child.type === "file") {
        return child.path.toLowerCase().includes(filter) || friendlyName(child.name).toLowerCase().includes(filter);
      }
      return hasVisibleDescendant(child, filter);
    });
  }

  function renderNav() {
    const filter = searchInput.value.trim().toLowerCase();
    navTree.innerHTML = "";
    renderTree(DOCS.tree, navTree, filter);
  }

  function parseInline(text, basePath) {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const resolved = resolveRelativePath(basePath, href);
      if (resolved) {
        return `<a href="#${encodeURIComponent(resolved).replace(/%2F/g, "/")}" data-doc-link="${escapeHtml(resolved)}">${escapeHtml(label)}</a>`;
      }
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
    });
    return html;
  }

  function renderMarkdown(markdown, path) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        i += 1;
        continue;
      }

      const fenceMatch = line.match(/^```(\w+)?\s*$/);
      if (fenceMatch) {
        const language = (fenceMatch[1] || "").toLowerCase();
        const buffer = [];
        i += 1;
        while (i < lines.length && !lines[i].match(/^```\s*$/)) {
          buffer.push(lines[i]);
          i += 1;
        }
        i += 1;
        const code = buffer.join("\n");
        if (language === "mermaid") {
          blocks.push(`<div class="mermaid-host"><pre class="mermaid-fallback" data-mermaid>${escapeHtml(code)}</pre></div>`);
        } else {
          blocks.push(`<pre><code class="language-${escapeHtml(language || "plain")}">${escapeHtml(code)}</code></pre>`);
        }
        continue;
      }

      if (/^\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
        const tableLines = [line];
        i += 2;
        while (i < lines.length && /^\|.+\|\s*$/.test(lines[i])) {
          tableLines.push(lines[i]);
          i += 1;
        }
        blocks.push(renderTable(tableLines, path));
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const text = heading[2].trim();
        const id = slugify(text);
        blocks.push(`<h${level} id="${escapeHtml(id)}">${parseInline(text, path)}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ""));
          i += 1;
        }
        blocks.push(`<blockquote>${quoteLines.map((entry) => parseInline(entry, path)).join("<br>")}</blockquote>`);
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push("<hr>");
        i += 1;
        continue;
      }

      const unordered = line.match(/^(\s*)[-*]\s+(.+)$/);
      const ordered = line.match(/^(\s*)\d+\.\s+(.+)$/);
      if (unordered || ordered) {
        const type = ordered ? "ol" : "ul";
        const buffer = [];
        while (i < lines.length) {
          const candidate = lines[i];
          const itemMatch = type === "ol"
            ? candidate.match(/^\s*\d+\.\s+(.+)$/)
            : candidate.match(/^\s*[-*]\s+(.+)$/);
          if (!itemMatch) break;
          buffer.push(`<li>${parseInline(itemMatch[1], path)}</li>`);
          i += 1;
        }
        blocks.push(`<${type}>${buffer.join("")}</${type}>`);
        continue;
      }

      const paragraph = [];
      while (i < lines.length && lines[i].trim() && !lines[i].match(/^(#{1,6})\s+/) && !lines[i].match(/^```/) && !lines[i].match(/^>\s?/) && !lines[i].match(/^(\s*)[-*]\s+/) && !lines[i].match(/^(\s*)\d+\.\s+/) && !lines[i].match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      blocks.push(`<p>${parseInline(paragraph.join(" "), path)}</p>`);
    }

    return blocks.join("\n");
  }

  function renderTable(lines, path) {
    const rows = lines.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    const header = rows[0];
    const body = rows.slice(1);
    return `
      <table>
        <thead>
          <tr>${header.map((cell) => `<th>${parseInline(cell, path)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${body.map((row) => `<tr>${row.map((cell) => `<td>${parseInline(cell, path)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    `;
  }

  function renderMermaid() {
    const nodes = Array.from(docBody.querySelectorAll("[data-mermaid]"));
    if (!nodes.length) return;

    if (!(window.mermaid && typeof window.mermaid.run === "function")) {
      return;
    }

    try {
      window.mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
      nodes.forEach((node) => {
        node.classList.remove("mermaid-fallback");
        node.classList.add("mermaid");
      });
      window.mermaid.run({ nodes });
    } catch (error) {
      console.warn("Falha ao renderizar Mermaid localmente.", error);
    }
  }

  function bindDocLinks() {
    docBody.querySelectorAll("[data-doc-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = link.getAttribute("data-doc-link");
        if (target) {
          openDocument(target);
        }
      });
    });
  }

  function openDocument(path, updateHash = true) {
    const markdown = DOCS.pages[path];
    if (!markdown) {
      currentTitle.textContent = "Documento não encontrado";
      currentPath.textContent = path || "docs/";
      docBody.innerHTML = `<section class="empty-state"><h3>Arquivo não encontrado</h3><p>O caminho solicitado não existe no índice serializado.</p></section>`;
      return;
    }

    currentPathKey = path;
    ensureExpandedFor(path);
    renderNav();

    currentTitle.textContent = extractTitle(path, markdown);
    currentPath.textContent = "docs/" + path;
    docBody.innerHTML = renderMarkdown(markdown, path);
    bindDocLinks();
    renderMermaid();

    if (updateHash) {
      setHash(path);
    }
  }

  function closeSidebarOnMobile() {
    if (window.innerWidth <= 980) {
      sidebar.classList.remove("is-open");
      document.body.classList.remove("sidebar-open");
    }
  }

  function toggleSidebar() {
    sidebar.classList.toggle("is-open");
    document.body.classList.toggle("sidebar-open", sidebar.classList.contains("is-open"));
  }

  function boot() {
    if (!Array.isArray(DOCS.tree) || !DOCS.pages || !Object.keys(DOCS.pages).length) {
      currentTitle.textContent = "Conteúdo indisponível";
      currentPath.textContent = "docs/assets/content.js";
      docBody.innerHTML = `
        <section class="empty-state">
          <h3>Índice documental ausente</h3>
          <p>O arquivo <code>assets/content.js</code> não foi carregado corretamente.</p>
        </section>
      `;
      return;
    }

    sidebarToggle.addEventListener("click", toggleSidebar);
    searchInput.addEventListener("input", renderNav);

    const firstPath = Object.keys(DOCS.pages).sort((a, b) => a.localeCompare(b, "pt-BR"))[0];
    currentPathKey = getPathFromHash() || firstPath;
    ensureExpandedFor(currentPathKey);
    renderNav();
    openDocument(currentPathKey, false);

    window.addEventListener("hashchange", () => {
      const next = getPathFromHash();
      if (next && next !== currentPathKey) {
        openDocument(next, false);
      }
    });
  }

  if (!DOCS.tree.length) {
    DOCS.tree = buildTreeData(Object.keys(DOCS.pages));
  }

  boot();
})();
