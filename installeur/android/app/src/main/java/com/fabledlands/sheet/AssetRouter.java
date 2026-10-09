package com.fabledlands.sheet;

import android.content.res.AssetManager;
import android.util.Log;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Routage des requetes WebView vers les assets de l'APK.
 * Miroir exact de installeur/android/poc/server.js (serveur du POC) :
 *
 *   /                       -> redirection page d'amorçage
 *   /fl-sheet/boot-poc.html -> assets/poc/boot.html
 *   /fl-sheet/cgi-worker.mjs-> assets/poc/cgi-worker.mjs
 *   /fl-sheet/*.php         -> 404 (source PHP JAMAIS servie en
 *                              statique ; le Service Worker
 *                              intercepte ces URL quand il est actif)
 *   /fl-sheet/*             -> assets/www/* (static filtre)
 *   /css2                   -> assets/fonts/fonts.css (Google Fonts
 *                              remplaces par les fontes locales)
 *   /gfont/<f>              -> assets/fonts/<f> (woff2 locaux)
 *   /ajax/libs/font-awesome/*-> assets/fa/* (FA 6.5.2 locale)
 *   /poc/php-src/*.php      -> assets/www/* en text/plain
 *                              (source brute pour l'amorçage — route
 *                              hors portee du SW, comme sur le POC)
 *   /poc/vendor/*           -> assets/vendor/* (graphe php-cgi-wasm)
 *   /poc/*                  -> assets/poc/* (boot, worker, manifest)
 *
 * Pas de contenu additionnel ni d'APK compagnon : Fabled n'a aucune
 * ressource non redistribuable (contrairement a dcc-sheet).
 */
public final class AssetRouter {

    private static final Set<String> STATIC_EXT = new HashSet<>(Arrays.asList(
            ".html", ".css", ".js", ".mjs", ".json", ".txt",
            ".svg", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".ico", ".avif",
            ".woff", ".woff2", ".ttf"));

    private static final Map<String, String> TYPES = new HashMap<>();
    private static final Map<String, String> TEXT_EXT = new HashMap<>();

    static {
        TYPES.put(".html", "text/html");
        TYPES.put(".css", "text/css");
        TYPES.put(".js", "text/javascript");
        TYPES.put(".mjs", "text/javascript");
        TYPES.put(".json", "application/json");
        TYPES.put(".txt", "text/plain");
        TYPES.put(".svg", "image/svg+xml");
        TYPES.put(".png", "image/png");
        TYPES.put(".webp", "image/webp");
        TYPES.put(".jpg", "image/jpeg");
        TYPES.put(".jpeg", "image/jpeg");
        TYPES.put(".gif", "image/gif");
        TYPES.put(".ico", "image/x-icon");
        TYPES.put(".avif", "image/avif");
        TYPES.put(".woff", "font/woff");
        TYPES.put(".woff2", "font/woff2");
        TYPES.put(".ttf", "font/ttf");
        TYPES.put(".wasm", "application/wasm");
        TYPES.put(".so", "application/wasm"); /* side modules wasm */
        TYPES.put(".php", "text/plain");      /* source brute uniquement */
        for (String t : new String[]{"html", "css", "js", "mjs", "json", "txt", "svg"}) {
            TEXT_EXT.put("." + t, "UTF-8");
        }
    }

    private static final String FA_PREFIX = "/ajax/libs/font-awesome/";

    private final AssetManager assets;

    public AssetRouter(AssetManager assets) {
        this.assets = assets;
    }

    /** @return reponse WebView, ou null si l'URL sort du perimetre (reseau reel). */
    public WebResourceResponse respond(String path) {
        if (path == null || path.isEmpty()) {
            return notFound();
        }
        if (path.contains("..")) {
            return notFound();
        }

        if (path.equals("/")) {
            return redirect("/fl-sheet/boot-poc.html");
        }
        if (path.equals("/fl-sheet") || path.equals("/fl-sheet/")) {
            /* Racine de la webapp (le serveur du POC servait index.html ;
               rediriger vers boot-poc.html creerait une boucle). */
            return asset("www/index.html");
        }
        if (path.equals("/css2")) {
            /* Google Fonts (index.html) remplace par les fontes locales :
               l'APK n'a pas de permission INTERNET, le fallback systeme
               debordeait la topbar (bouton Inscription coupe). Familles
               identiques, sous-ensembles latin/latin-ext, licence OFL 1.1
               incluse (fonts/OFL-*.txt). */
            return asset("fonts/fonts.css");
        }
        if (path.startsWith("/gfont/")) {
            String rel = path.substring("/gfont/".length());
            if (rel.isEmpty() || rel.contains("..")) {
                return notFound();
            }
            return asset("fonts/" + rel);
        }
        /* Font Awesome 6.5.2 locale : index.html charge cdnjs, hors
           porte sans INTERNET. Route specifique (all.min.css reference
           ses fontes en url(../webfonts/…) -> memes routes, aucune
           autre entree necessaire). La query ?v=6.5.2 est ignoree :
           on ne travaille que sur getPath(). */
        if (path.startsWith(FA_PREFIX)) {
            String rel = path.substring(FA_PREFIX.length());
            if (rel.isEmpty() || rel.contains("..")) {
                return notFound();
            }
            return asset("fa/" + rel);
        }
        if (path.equals("/fl-sheet/boot-poc.html")) {
            return asset("poc/boot.html");
        }
        if (path.equals("/fl-sheet/cgi-worker.mjs")) {
            return asset("poc/cgi-worker.mjs");
        }

        if (path.startsWith("/fl-sheet/")) {
            String rel = path.substring("/fl-sheet/".length());
            if (rel.endsWith(".php")) {
                /* Source PHP jamais servie : soit le SW l'execute,
                   soit (premier lancement hors SW) on renvoie un 404. */
                return notFound();
            }
            if (!STATIC_EXT.contains(ext(rel))) {
                return notFound();
            }
            return asset("www/" + rel);
        }

        if (path.startsWith("/poc/php-src/")) {
            String rel = path.substring("/poc/php-src/".length());
            if (!rel.endsWith(".php") || rel.contains("..")) {
                return notFound();
            }
            return asset("www/" + rel);
        }

        if (path.startsWith("/poc/vendor/")) {
            String rel = path.substring("/poc/vendor/".length());
            if (rel.isEmpty() || rel.contains("..")) {
                return notFound();
            }
            return asset("vendor/" + rel);
        }

        if (path.startsWith("/poc/")) {
            String rel = path.substring("/poc/".length());
            if (rel.isEmpty()) {
                rel = "boot.html";
            }
            if (rel.contains("..")) {
                return notFound();
            }
            return asset("poc/" + rel);
        }

        return notFound();
    }

    private static String ext(String rel) {
        int i = rel.lastIndexOf('.');
        return i < 0 ? "" : rel.substring(i).toLowerCase(Locale.ROOT);
    }

    private WebResourceResponse asset(String assetPath) {
        try {
            InputStream stream = assets.open(assetPath);
            String mime = TYPES.getOrDefault(ext(assetPath), "application/octet-stream");
            String encoding = TEXT_EXT.get(ext(assetPath)); /* null = binaire */
            Map<String, String> headers = new LinkedHashMap<>();
            headers.put("Cache-Control", "no-store"); /* APK mis a jour = assets nouveaux */
            /* CORS : les @font-face de fonts.css sont charges depuis une
               autre origine (fonts.googleapis.com) — sans cet en-tete,
               le navigateur rejette le telechargement des woff2. */
            headers.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse(mime, encoding, stream);
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse redirect(String location) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Location", location);
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/plain", "UTF-8", 302, "Found",
                headers, new ByteArrayInputStream(new byte[0]));
    }

    private static WebResourceResponse notFound() {
        byte[] body = "404".getBytes(StandardCharsets.UTF_8);
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                headers, new ByteArrayInputStream(body));
    }
}
