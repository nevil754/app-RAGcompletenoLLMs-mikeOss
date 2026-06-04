import type { createServerSupabase } from "./supabase";

//Questo file è un layer di “data enrichment” sopra Supabase: prende documenti e “attacca” informazioni aggiuntive sulle versioni (storage path, pdf, versioni latest, ecc.).

type Supa = ReturnType<typeof createServerSupabase>;  //prende il tipo di ritorno di createServerSupabase

interface DocRow {
    id: string;
    latest_version_number?: number | null;
    [k: string]: unknown;  //"può avere altre proprietà"
}

interface VersionPathRow extends DocRow {
    /** Set from document_versions.storage_path of the active version. */
    storage_path?: string | null;
    /** Set from document_versions.pdf_storage_path of the active version. */
    pdf_storage_path?: string | null;
    current_version_id?: string | null;
    /** Set from document_versions.version_number of the active version. */
    active_version_number?: number | null;
}  //ogni documento può avere info sulla versione attiva

export interface ActiveVersion {
    id: string;
    storage_path: string;
    pdf_storage_path: string | null;
    version_number: number | null;
    display_name: string | null;
    source: string | null;
}  //tipo “pulito finale” che la funzione ritorna

/**
 * Resolve storage paths for a document. Prefers the version pointed to by
 * `versionId` (if it belongs to this document); else falls back to
 * `documents.current_version_id`. Returns null if no usable version exists.
 *
 * After the storage_path/pdf_storage_path columns moved off `documents`,
 * every read-from-storage path goes through here.
 */
export async function loadActiveVersion(
    documentId: string,
    db: Supa,
    versionId?: string | null,
): Promise<ActiveVersion | null> {
    const { data: doc } = await db  //doc è var creata al volo tramite destructuring con rename, here dopo il return da supabase prendi 'data' e rinominalo 'doc'
        .from("documents")
        .select("current_version_id")
        .eq("id", documentId)
        .single();
    const targetVersionId =
        (typeof versionId === "string" && versionId) ||   //OR logico, se non c'è il primo prendi il secondo
        (doc?.current_version_id as string | undefined) ||
        null;
    if (!targetVersionId) return null;
    const { data: v } = await db
        .from("document_versions")
        .select(
            "id, document_id, storage_path, pdf_storage_path, version_number, display_name, source",
        )
        .eq("id", targetVersionId)
        .single();
    if (!v || v.document_id !== documentId || !v.storage_path) return null;
    return {
        id: v.id as string,
        storage_path: v.storage_path as string,
        pdf_storage_path: (v.pdf_storage_path as string | null) ?? null,  //se proprio manca il 'v' allora utilizza il ?? null
        version_number: (v.version_number as number | null) ?? null,
        display_name: (v.display_name as string | null) ?? null,
        source: (v.source as string | null) ?? null,
    };
}

/**
 * For a list of documents, look up the active version for each and merge
 * `storage_path` + `pdf_storage_path` onto the row. One round-trip total
 * regardless of list size. Documents with no current_version_id retain
 * null paths.
 */
export async function attachActiveVersionPaths<T extends VersionPathRow>(
    db: Supa,
    docs: T[],
): Promise<T[]> {
    if (docs.length === 0) return docs;
    const versionIds = docs
        .map((d) => d.current_version_id)  //da ogni d pesca solo d.current_version_id
        .filter((id): id is string => typeof id === "string");  //filtra eliminando i null/undefined e dice a ts che qui sono solo stringhe
    if (versionIds.length === 0) {
        for (const d of docs) {
            d.storage_path = null;
            d.pdf_storage_path = null;
        }
        return docs;  
    }
    const { data: rows } = await db
        .from("document_versions")
        .select("id, storage_path, pdf_storage_path, version_number")
        .in("id", versionIds);  //versionIds è un array
    const byId = new Map<
        string,
        {
            storage_path: string | null;
            pdf_storage_path: string | null;
            version_number: number | null;
        }
    >();
    for (const r of (rows ?? []) as {
        id: string;
        storage_path: string | null;
        pdf_storage_path: string | null;
        version_number: number | null;
    }[]) {
        byId.set(r.id, {
            storage_path: r.storage_path ?? null,
            pdf_storage_path: r.pdf_storage_path ?? null,
            version_number: r.version_number ?? null,
        });  //aggiungi le coppie key-value nel Set called byId
    }
    for (const d of docs) {
        const v = d.current_version_id ? byId.get(d.current_version_id) : null;
        d.storage_path = v?.storage_path ?? null;  //set
        d.pdf_storage_path = v?.pdf_storage_path ?? null;  //set
        d.active_version_number = v?.version_number ?? null;  //set
    }
    return docs;
}

/*
 * Given a list of document rows, attach `latest_version_number` — the
 * max `version_number` across all assistant_edit rows for that doc, or
 * null if none. Mutates rows in place and returns the same reference.
 * One extra query regardless of list size.
 */
export async function attachLatestVersionNumbers<T extends DocRow>(
    db: Supa,
    docs: T[],
): Promise<T[]> {
    if (docs.length === 0) return docs;
    const ids = docs.map((d) => d.id);
    const { data: rows } = await db
        .from("document_versions")
        .select("document_id, version_number")
        .in("document_id", ids)
        .eq("source", "assistant_edit")  //eq() filtra "source" uguale a "assistant_edit"
        .not("version_number", "is", null);  //not() filtra "version_number" diverso da null
    const latestByDoc = new Map<string, number>();
    for (const r of (rows ?? []) as {
        document_id: string;
        version_number: number | null;
    }[]) {
        if (r.version_number == null) continue;  //skip this cycle
        const prev = latestByDoc.get(r.document_id) ?? 0;  //cerca di prendere nel Set, se non trova allora return 0.
        if (r.version_number > prev)
            latestByDoc.set(r.document_id, r.version_number);  //aggiungi nuove key-value pair al Set
    }
    for (const d of docs) {
        d.latest_version_number = latestByDoc.get(d.id) ?? null;
    }
    return docs;
}


