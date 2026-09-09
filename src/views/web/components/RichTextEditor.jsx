import React, { useRef, useEffect, useState } from "react";
import { 
  List, 
  Quote, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Link as LinkIcon,
  Video
} from "lucide-react";

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Escribe el contenido aquí...",
  minHeight = "280px"
}) {
  const editorRef = useRef(null);
  const isInternalUpdate = useRef(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    h2: false,
    h3: false,
    quote: false,
    list: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
  });

  // Sincronizar valor externo al editor (por ejemplo en modo edición o reset)
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }
    isInternalUpdate.current = false;
  }, [value]);

  // Actualizar estados activos de la barra de herramientas según la selección actual
  const checkActiveFormats = () => {
    if (!document.queryCommandState) return;

    try {
      const blockTag = document.queryCommandValue("formatBlock")?.toLowerCase() || "";
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        h2: blockTag === "h2",
        h3: blockTag === "h3",
        quote: blockTag === "blockquote",
        list: document.queryCommandState("insertUnorderedList"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
      });
    } catch {
      // Ignorar excepciones menores en browsers antiguos
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      const html = editorRef.current.innerHTML;
      if (onChange) {
        onChange(html);
      }
      checkActiveFormats();
    }
  };

  const executeCommand = (command, val = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, val);
    handleInput();
  };

  const handleToggleHeading = (level) => {
    const currentBlock = document.queryCommandValue("formatBlock")?.toLowerCase() || "";
    if (currentBlock === level) {
      executeCommand("formatBlock", "<p>");
    } else {
      executeCommand("formatBlock", `<${level}>`);
    }
  };

  const handleToggleQuote = () => {
    const currentBlock = document.queryCommandValue("formatBlock")?.toLowerCase() || "";
    if (currentBlock === "blockquote") {
      executeCommand("formatBlock", "<p>");
    } else {
      executeCommand("formatBlock", "<blockquote>");
    }
  };

  const handleAddLink = () => {
    const previousUrl = "";
    const url = window.prompt("Introduce la dirección web (URL):", previousUrl || "https://");
    if (url && url.trim() !== "" && url !== "https://") {
      executeCommand("createLink", url.trim());
    }
  };

  const handleAddVideo = () => {
    const url = window.prompt("Introduce el enlace del video (YouTube o Vimeo):", "https://www.youtube.com/watch?v=");
    if (!url || !url.trim()) return;

    const urlLimpia = url.trim();
    let embedUrl = null;

    // YouTube: formatos watch?v=, youtu.be/, shorts/, embed/
    const ytMatch = urlLimpia.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    }

    // Vimeo: formato vimeo.com/ID
    const vimeoMatch = urlLimpia.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
    if (vimeoMatch && vimeoMatch[3]) {
      embedUrl = `https://player.vimeo.com/video/${vimeoMatch[3]}`;
    }

    if (embedUrl) {
      const htmlVideo = `<div class="video-embed-wrapper my-6 aspect-video w-full rounded-2xl overflow-hidden shadow-md bg-black"><iframe src="${embedUrl}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p><br></p>`;
      if (editorRef.current) {
        editorRef.current.focus();
      }
      document.execCommand("insertHTML", false, htmlVideo);
      handleInput();
    } else if (urlLimpia.match(/\.(mp4|webm|ogg)$/i)) {
      const htmlVideo = `<div class="video-embed-wrapper my-6 w-full rounded-2xl overflow-hidden shadow-md bg-black"><video controls class="w-full h-auto"><source src="${urlLimpia}" type="video/mp4">Tu navegador no soporta video.</video></div><p><br></p>`;
      if (editorRef.current) {
        editorRef.current.focus();
      }
      document.execCommand("insertHTML", false, htmlVideo);
      handleInput();
    } else {
      window.alert("Enlace no reconocido. Por favor usa un enlace válido de YouTube (ej. https://www.youtube.com/watch?v=...) o Vimeo.");
    }
  };

  return (
    <div className="w-full border border-gray-300 rounded-xl overflow-hidden bg-white shadow-xs focus-within:border-light-blue focus-within:ring-2 focus-within:ring-light-blue/20 transition-all">
      {/* BARRA DE HERRAMIENTAS */}
      <div 
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200 select-none"
        onMouseDown={(e) => {
          if (e.target.tagName !== "INPUT") {
            e.preventDefault();
          }
        }}
      >
        {/* GRUPO: BOLD & ITALIC */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
          <button
            type="button"
            title="Negrita (Ctrl+B)"
            onClick={() => executeCommand("bold")}
            className={`w-8 h-8 flex items-center justify-center rounded-md font-serif font-black text-base cursor-pointer transition-colors ${
              activeFormats.bold 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            B
          </button>
          <button
            type="button"
            title="Cursiva (Ctrl+I)"
            onClick={() => executeCommand("italic")}
            className={`w-8 h-8 flex items-center justify-center rounded-md font-serif italic font-bold text-base cursor-pointer transition-colors ${
              activeFormats.italic 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            I
          </button>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />

        {/* GRUPO: H2 & H3 */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
          <button
            type="button"
            title="Subtítulo Principal (H2)"
            onClick={() => handleToggleHeading("h2")}
            className={`px-2 h-8 flex items-center justify-center rounded-md font-sans font-bold text-xs cursor-pointer transition-colors ${
              activeFormats.h2 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            H2
          </button>
          <button
            type="button"
            title="Subtítulo Secundario (H3)"
            onClick={() => handleToggleHeading("h3")}
            className={`px-2 h-8 flex items-center justify-center rounded-md font-sans font-bold text-xs cursor-pointer transition-colors ${
              activeFormats.h3 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            H3
          </button>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />

        {/* GRUPO: LISTA Y CITA */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
          <button
            type="button"
            title="Lista con viñetas"
            onClick={() => executeCommand("insertUnorderedList")}
            className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
              activeFormats.list 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            <List size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            title="Cita textual"
            onClick={handleToggleQuote}
            className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
              activeFormats.quote 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            <Quote size={15} strokeWidth={2.5} />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />

        {/* GRUPO: ALINEACIÓN */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
          <button
            type="button"
            title="Alinear a la izquierda"
            onClick={() => executeCommand("justifyLeft")}
            className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
              activeFormats.justifyLeft 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            <AlignLeft size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            title="Centrar texto"
            onClick={() => executeCommand("justifyCenter")}
            className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
              activeFormats.justifyCenter 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            <AlignCenter size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            title="Alinear a la derecha"
            onClick={() => executeCommand("justifyRight")}
            className={`w-8 h-8 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
              activeFormats.justifyRight 
                ? "bg-main-blue text-white shadow-inner" 
                : "text-gray-700 hover:bg-gray-100 hover:text-main-blue"
            }`}
          >
            <AlignRight size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />

        {/* ENLACE Y VIDEO */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
          <button
            type="button"
            title="Insertar enlace web"
            onClick={handleAddLink}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 hover:text-main-blue cursor-pointer transition-colors"
          >
            <LinkIcon size={15} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            title="Insertar video (YouTube o Vimeo)"
            onClick={handleAddVideo}
            className="w-8 h-8 flex items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 hover:text-main-blue cursor-pointer transition-colors"
          >
            <Video size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ÁREA DE EDICIÓN ENRIQUECIDA */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyUp={checkActiveFormats}
          onMouseUp={checkActiveFormats}
          className="rich-editor-content p-5 text-gray-800 font-sans text-base leading-relaxed outline-none overflow-y-auto cursor-text focus:ring-0"
          style={{ minHeight }}
          data-placeholder={placeholder}
          role="textbox"
          aria-multiline="true"
          aria-label="Contenido del Artículo"
        />
      </div>
    </div>
  );
}
