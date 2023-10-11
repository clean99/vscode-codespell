/**
 * Defines diagnostic data structure containing a typo for a range of a
 * document.
 */

import * as vscode from 'vscode';
import { DocumentsToTypos, spellCheck } from './spellcheck';
import { CodespellTypo } from './typo';
import { findDifferences } from './utils';
import * as _ from 'lodash';
/**
 * Used to associate diagnostic entries with code actions.
 */
export const CODE_SPELL_MENTION = 'codespell';

/** Dictionary of `vscode.TextDocument` to `codespellDiagnostic[]`. */
const codespellDiagnostics =
  vscode.languages.createDiagnosticCollection('codespell');

/** Returns the diagnostics for the given document. */
export function getCodespellDiagnostics(
  doc: vscode.TextDocument,
): CodespellDiagnostic[] {
  return codespellDiagnostics.get(doc.uri) as CodespellDiagnostic[];
}

export function escapeRegExp(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Makes the diagnostics out of typos of document.
 *
 * Automatically called when the document is edited.
 */
export function refreshDiagnostics(doc: vscode.TextDocument): void {
  const typos = DocumentsToTypos.getTypos(doc);
  const docText = doc.getText();
  if (!typos) {
    return;
  }

  const diagnostics: vscode.Diagnostic[] = [];

  typos.forEach((typo: CodespellTypo) => {
    let match: RegExpExecArray | null;
    // Assume token is not a regular expression special character. If it is, need to escape it.
    // The 'm' flag enables multi-line matching
    const regex = new RegExp(escapeRegExp(typo.token), 'gm');

    while ((match = regex.exec(docText)) !== null) {
        // Get line and character for start position
        const startPos = doc.positionAt(match.index);
        // Get line and character for end position
        const endPos = doc.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        diagnostics.push(
            new CodespellDiagnostic(
                range,
                typo,
                match
            ),
        );
    }
});

  codespellDiagnostics.set(doc.uri, diagnostics);
}

/** Diagnostic data structure containing a typo for a range of a document. */
export class CodespellDiagnostic extends vscode.Diagnostic {
  typo: CodespellTypo;
  suggestions: string[];
  token: string;

  constructor(
    range: vscode.Range,
    typo: CodespellTypo,
    matched: RegExpExecArray,
  ) {
    super(
      range,
      typo.info,
      typo.severity !== undefined
        ? typo.severity
        : typo.isCommon !== false
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information,
    );

    this.typo = typo;
    this.code = CODE_SPELL_MENTION;
    this.token = typo.token;
    this.suggestions = typo.suggestions;
  }
}

/** Subscribes `refreshDiagnostics` to documents change events. */
export function subscribeDiagnosticsToDocumentChanges(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(codespellDiagnostics);
  // A Map to store the last saved content of documents.
  let lastSavedContent: Map<string, string> = new Map();

  // Listen for save events
  if (vscode.window.activeTextEditor) {
    refreshDiagnostics(vscode.window.activeTextEditor.document);
     // Retrieve the document's URI as a string to use as a key
     let documentUri = vscode.window.activeTextEditor.document.uri.toString();

     // Get the content at the time of save
     let currentContent = vscode.window.activeTextEditor.document.getText();
    lastSavedContent.set(documentUri, currentContent);
  }


    let saveDisposable = vscode.workspace.onDidSaveTextDocument(async document => {
        // Retrieve the document's URI as a string to use as a key
        let documentUri = document.uri.toString();

        // Get the content at the time of save
        let currentContent = document.getText();

        // Retrieve the last saved content from the map
        let previousContent = lastSavedContent.get(documentUri) || "";

        // Get differences between the previous content and current content
        let differences = findDifferences(previousContent, currentContent);
        console.log("Differences:", differences);
        if(!_.isEmpty(differences)) {
          await spellCheck(document, differences)
          refreshDiagnostics(document);
        }
        
        // Update the last saved content in the map
        lastSavedContent.set(documentUri, currentContent);
    });

    let docChangeListener = vscode.workspace.onDidChangeTextDocument(() => {
      console.log('Document Changed');
      if(vscode.window.activeTextEditor?.document) {
        refreshDiagnostics(vscode.window.activeTextEditor.document);
      }
  });


    // Register disposable
    context.subscriptions.push(saveDisposable, docChangeListener);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        refreshDiagnostics(editor.document);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      codespellDiagnostics.delete(doc.uri),
    ),
  );
  
}
