import { afterEach, describe, expect, test } from "bun:test";
import { ApiError, apiFetch, normalizeBaseUrl } from "../src/api/client";
import {
  getGlobalConfig,
  getCompleteServerConfig,
  getPathDefaultsConfig,
} from "../src/api/configApi";
import {
  addPath,
  deletePath,
  getPathDetail,
  getPathsList,
  getViewerDetail,
  kickPathTarget,
  patchPath,
} from "../src/api/pathsApi";
import { getServerInfo } from "../src/api/serverInfoApi";
import useAppStore from "../src/store/useAppStore";
import useMediaMTXApiStore from "../src/store/useMediaMTXApiStore";

const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound() {
  return new Response("404 page not found", {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "text/plain" },
  });
}

function resetStores(serverUrl = "http://localhost:9997") {
  useMediaMTXApiStore.getState().resetForServerUrl("");
  useAppStore.setState({ serverUrl });
  useMediaMTXApiStore.getState().resetForServerUrl(serverUrl);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetStores();
});

describe("normalizeBaseUrl", () => {
  test("strips a single trailing slash", () => {
    expect(normalizeBaseUrl("http://localhost:9997/")).toBe(
      "http://localhost:9997",
    );
  });

  test("strips multiple trailing slashes", () => {
    expect(normalizeBaseUrl("http://localhost:9997///")).toBe(
      "http://localhost:9997",
    );
  });

  test("leaves a URL without a trailing slash unchanged", () => {
    expect(normalizeBaseUrl("http://localhost:9997")).toBe(
      "http://localhost:9997",
    );
  });

  test("preserves non-trailing slashes in the path", () => {
    expect(normalizeBaseUrl("http://localhost:9997/v3/info")).toBe(
      "http://localhost:9997/v3/info",
    );
  });

  test("handles an empty base string", () => {
    expect(normalizeBaseUrl("")).toBe("");
  });
});

describe("apiFetch URL construction with a trailing-slash server URL", () => {
  test("builds a single-slash request path when serverUrl ends with a slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({
        version: "v1.19.2",
        started: "2026-09-10T11:00:32Z",
      });
    }) as typeof fetch;

    await apiFetch<unknown>("/v3/info");

    expect(captured).toEqual(["http://localhost:9997/v3/info"]);
  });

  test("strips multiple trailing slashes so the path never begins with //", async () => {
    resetStores("http://localhost:9997///");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({});
    }) as typeof fetch;

    await apiFetch<unknown>("/v3/info");

    expect(captured).toEqual(["http://localhost:9997/v3/info"]);
  });

  test("accepts an explicit trailing-slash serverUrl argument", async () => {
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({});
    }) as typeof fetch;

    await apiFetch<unknown>("/v3/info", undefined, "http://localhost:9997/");

    expect(captured).toEqual(["http://localhost:9997/v3/info"]);
  });

  test("does not alter an already-clean serverUrl (no regression)", async () => {
    resetStores("http://localhost:9997");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({});
    }) as typeof fetch;

    await apiFetch<unknown>("/v3/info");

    expect(captured).toEqual(["http://localhost:9997/v3/info"]);
  });
});

describe("read APIs resolve a trailing-slash serverUrl to single-slash paths", () => {
  test("getServerInfo requests /v3/info instead of //v3/info", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({
        version: "v1.19.2",
        started: "2026-09-10T11:00:32Z",
      });
    }) as typeof fetch;

    const info = await getServerInfo();

    expect(captured).toEqual(["http://localhost:9997/v3/info"]);
    expect(info.version).toBe("v1.19.2");
  });

  test("getPathsList requests both list endpoints without a leading double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      captured.push(url);
      if (url.endsWith("/v3/paths/list")) {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }
      if (url.endsWith("/v3/config/paths/list")) {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }
      return notFound();
    }) as typeof fetch;

    const list = await getPathsList();

    expect(captured).toContain("http://localhost:9997/v3/paths/list");
    expect(captured).toContain("http://localhost:9997/v3/config/paths/list");
    expect(captured).not.toContain("http://localhost:9997//v3/paths/list");
    expect(captured).not.toContain(
      "http://localhost:9997//v3/config/paths/list",
    );
    expect(list.items).toEqual([]);
  });

  test("getGlobalConfig requests /v3/config/global/get without a double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({ logLevel: "info", paths: {} });
    }) as typeof fetch;

    const config = await getGlobalConfig();

    expect(captured).toEqual(["http://localhost:9997/v3/config/global/get"]);
    expect(config.logLevel).toBe("info");
  });

  test("getCompleteServerConfig requests global and pathdefaults endpoints without a double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      const url = String(input);
      captured.push(url);
      if (url.endsWith("/v3/config/global/get")) {
        return jsonResponse({ logLevel: "info" });
      }
      if (url.endsWith("/v3/config/pathdefaults/get")) {
        return jsonResponse({ source: "publisher" });
      }
      return notFound();
    }) as typeof fetch;

    const config = await getCompleteServerConfig();

    expect(captured).toContain("http://localhost:9997/v3/config/global/get");
    expect(captured).toContain(
      "http://localhost:9997/v3/config/pathdefaults/get",
    );
    expect(captured).not.toContain(
      "http://localhost:9997//v3/config/global/get",
    );
    expect(captured).not.toContain(
      "http://localhost:9997//v3/config/pathdefaults/get",
    );
    expect(config.pathDefaults).toEqual({ source: "publisher" });
    expect(config.paths).toEqual({});
  });

  test("getPathDefaultsConfig requests /v3/config/pathdefaults/get without a double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({ source: "publisher", record: false });
    }) as typeof fetch;

    const defaults = await getPathDefaultsConfig();

    expect(captured).toEqual([
      "http://localhost:9997/v3/config/pathdefaults/get",
    ]);
    expect(defaults).toEqual({ source: "publisher", record: false });
  });

  test("getPathDetail encodes the name onto a single-slash path", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({ name: "a/b", ready: true });
    }) as typeof fetch;

    await getPathDetail("a/b");

    expect(captured).toEqual(["http://localhost:9997/v3/paths/get/a%2Fb"]);
  });

  test("getViewerDetail encodes the id onto a single-slash endpoint path", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({ id: "viewer/1", state: "read" });
    }) as typeof fetch;

    await getViewerDetail({
      id: "viewer/1",
      type: "rtmpConn",
      endpoint: "rtmpconns",
    });

    expect(captured).toEqual([
      "http://localhost:9997/v3/rtmpconns/get/viewer%2F1",
    ]);
  });
});

describe("write helpers resolve a trailing-slash serverUrl to single-slash paths", () => {
  test("addPath POSTs to /v3/config/paths/add/<name> without a double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: { method: string; url: string; body: string | null }[] = [];
    globalThis.fetch = (async (input, init) => {
      captured.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: init?.body ? String(init.body) : null,
      });
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await addPath("camera-2", "rtsp://camera:554/stream");

    expect(captured).toEqual([
      {
        method: "POST",
        url: "http://localhost:9997/v3/config/paths/add/camera-2",
        body: JSON.stringify({ source: "rtsp://camera:554/stream" }),
      },
    ]);
  });

  test("deletePath DELETEs to /v3/config/paths/delete/<name> without a double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: { method: string; url: string }[] = [];
    globalThis.fetch = (async (input, init) => {
      captured.push({ method: init?.method ?? "GET", url: String(input) });
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await deletePath("camera-1");

    expect(captured).toEqual([
      {
        method: "DELETE",
        url: "http://localhost:9997/v3/config/paths/delete/camera-1",
      },
    ]);
  });

  test("patchPath PATCHes to /v3/config/paths/patch/<name> without a double slash", async () => {
    resetStores("http://localhost:9997/");
    const captured: { method: string; url: string; body: string | null }[] = [];
    globalThis.fetch = (async (input, init) => {
      captured.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: init?.body ? String(init.body) : null,
      });
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await patchPath("camera-1", "rtsp://camera:554/edited");

    expect(captured).toEqual([
      {
        method: "PATCH",
        url: "http://localhost:9997/v3/config/paths/patch/camera-1",
        body: JSON.stringify({ source: "rtsp://camera:554/edited" }),
      },
    ]);
  });

  test("kickPathTarget POSTs to /v3/<endpoint>/kick/<id> with encoded id on a single-slash path", async () => {
    resetStores("http://localhost:9997/");
    const captured: { method: string; url: string }[] = [];
    globalThis.fetch = (async (input, init) => {
      captured.push({ method: init?.method ?? "GET", url: String(input) });
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await kickPathTarget({
      id: "viewer/1",
      type: "rtmpConn",
      endpoint: "rtmpconns",
    });

    expect(captured).toEqual([
      {
        method: "POST",
        url: "http://localhost:9997/v3/rtmpconns/kick/viewer%2F1",
      },
    ]);
  });

  test("write helpers strip multiple trailing slashes", async () => {
    resetStores("http://localhost:9997///");
    const captured: { method: string; url: string }[] = [];
    globalThis.fetch = (async (input, init) => {
      captured.push({ method: init?.method ?? "GET", url: String(input) });
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await addPath("cam", "rtsp://camera/stream");
    await deletePath("cam");
    await patchPath("cam", "rtsp://camera/stream");
    await kickPathTarget({ id: "v1", type: "rtmpConn", endpoint: "rtmpconns" });

    expect(captured.map((entry) => entry.url)).toEqual([
      "http://localhost:9997/v3/config/paths/add/cam",
      "http://localhost:9997/v3/config/paths/delete/cam",
      "http://localhost:9997/v3/config/paths/patch/cam",
      "http://localhost:9997/v3/rtmpconns/kick/v1",
    ]);
  });
});

describe("trailing-slash serverUrl against a MediaMTX-like server (404s //, 200s /v3)", () => {
  function mediamtxLikeMock(captured: string[]) {
    return (async (input, init) => {
      const url = String(input);
      const parsed = new URL(url);
      captured.push(`${init?.method ?? "GET"} ${url}`);

      if (parsed.pathname.startsWith("//")) {
        return notFound();
      }
      if (parsed.pathname === "/v3/info") {
        return jsonResponse({
          version: "v1.19.2",
          started: "2026-09-10T11:00:32Z",
        });
      }
      if (parsed.pathname === "/v3/paths/list") {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }
      if (parsed.pathname === "/v3/config/paths/list") {
        return jsonResponse({ itemCount: 0, pageCount: 1, items: [] });
      }
      if (parsed.pathname === "/v3/config/global/get") {
        return jsonResponse({ logLevel: "info", paths: {} });
      }
      if (parsed.pathname === "/v3/config/pathdefaults/get") {
        return jsonResponse({ source: "publisher" });
      }
      if (parsed.pathname === "/v3/paths/get/camera-1") {
        return jsonResponse({ name: "camera-1", ready: true });
      }
      if (parsed.pathname === "/v3/rtmpconns/get/viewer-1") {
        return jsonResponse({ id: "viewer-1", state: "read" });
      }
      if (parsed.pathname === "/v3/config/paths/add/camera-2") {
        return new Response(null, { status: 204 });
      }
      if (parsed.pathname === "/v3/config/paths/patch/camera-1") {
        return new Response(null, { status: 204 });
      }
      if (parsed.pathname === "/v3/config/paths/delete/camera-1") {
        return new Response(null, { status: 204 });
      }
      if (parsed.pathname === "/v3/rtmpconns/kick/viewer-1") {
        return new Response(null, { status: 204 });
      }
      return notFound();
    }) as typeof fetch;
  }

  test("the mock emulates MediaMTX by 404ing double-slash paths and 200ing single-slash paths", async () => {
    resetStores("http://localhost:9997");
    globalThis.fetch = mediamtxLikeMock([]);

    const ok = await globalThis.fetch("http://localhost:9997/v3/info");
    expect(ok.status).toBe(200);

    const bad = await globalThis.fetch("http://localhost:9997//v3/info");
    expect(bad.status).toBe(404);
    expect(bad.statusText).toBe("Not Found");
  });

  test("getServerInfo succeeds on a trailing-slash serverUrl instead of throwing ApiError(404)", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = mediamtxLikeMock(captured);

    const info = await getServerInfo();

    expect(captured).toEqual(["GET http://localhost:9997/v3/info"]);
    expect(info.version).toBe("v1.19.2");
  });

  test("getPathsList, getGlobalConfig, getCompleteServerConfig, getPathDetail, and getViewerDetail all succeed", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = mediamtxLikeMock(captured);

    await expect(getPathsList()).resolves.toBeDefined();
    await expect(getGlobalConfig()).resolves.toBeDefined();
    await expect(getCompleteServerConfig()).resolves.toBeDefined();
    await expect(getPathDefaultsConfig()).resolves.toBeDefined();
    await expect(getPathDetail("camera-1")).resolves.toBeDefined();
    await expect(
      getViewerDetail({
        id: "viewer-1",
        type: "rtmpConn",
        endpoint: "rtmpconns",
      }),
    ).resolves.toBeDefined();

    for (const request of captured) {
      expect(request).not.toMatch(/9997\/\/v3/);
    }
  });

  test("addPath, deletePath, patchPath, and kickPathTarget all succeed on a trailing-slash serverUrl", async () => {
    resetStores("http://localhost:9997/");
    const captured: string[] = [];
    globalThis.fetch = mediamtxLikeMock(captured);

    await expect(
      addPath("camera-2", "rtsp://camera:554/stream"),
    ).resolves.toBeUndefined();
    await expect(
      patchPath("camera-1", "rtsp://camera:554/edited"),
    ).resolves.toBeUndefined();
    await expect(deletePath("camera-1")).resolves.toBeUndefined();
    await expect(
      kickPathTarget({
        id: "viewer-1",
        type: "rtmpConn",
        endpoint: "rtmpconns",
      }),
    ).resolves.toBeUndefined();

    expect(captured).toContain(
      "POST http://localhost:9997/v3/config/paths/add/camera-2",
    );
    expect(captured).toContain(
      "PATCH http://localhost:9997/v3/config/paths/patch/camera-1",
    );
    expect(captured).toContain(
      "DELETE http://localhost:9997/v3/config/paths/delete/camera-1",
    );
    expect(captured).toContain(
      "POST http://localhost:9997/v3/rtmpconns/kick/viewer-1",
    );
  });
});

describe("setServerUrl normalizes a trailing slash at the input layer", () => {
  test("strips a trailing slash before storing the server URL", () => {
    resetStores();

    useAppStore.getState().setServerUrl("http://localhost:9997/");

    expect(useAppStore.getState().serverUrl).toBe("http://localhost:9997");
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      "http://localhost:9997",
    );
  });

  test("strips multiple trailing slashes before storing the server URL", () => {
    resetStores();

    useAppStore.getState().setServerUrl("http://localhost:9997///");

    expect(useAppStore.getState().serverUrl).toBe("http://localhost:9997");
    expect(useMediaMTXApiStore.getState().serverUrl).toBe(
      "http://localhost:9997",
    );
  });

  test("leaves an already-clean server URL unchanged", () => {
    resetStores();

    useAppStore.getState().setServerUrl("http://localhost:9997");

    expect(useAppStore.getState().serverUrl).toBe("http://localhost:9997");
  });
});

describe("defense-in-depth: a trailing-slash serverUrl set directly still resolves through apiFetch", () => {
  test("a store value with a trailing slash (bypassing setServerUrl) is normalized by apiFetch", async () => {
    useMediaMTXApiStore.getState().resetForServerUrl("");
    useAppStore.setState({ serverUrl: "http://localhost:9997/" });
    useMediaMTXApiStore.getState().resetForServerUrl("http://localhost:9997/");

    const captured: string[] = [];
    globalThis.fetch = (async (input) => {
      captured.push(String(input));
      return jsonResponse({
        version: "v1.19.2",
        started: "2026-09-10T11:00:32Z",
      });
    }) as typeof fetch;

    await getServerInfo();

    expect(captured).toEqual(["http://localhost:9997/v3/info"]);
  });
});
