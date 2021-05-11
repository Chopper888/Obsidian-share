/*
THIS IS A GENERATED/BUNDLED FILE BY ROLLUP
if you want to view the source visit the plugins github repository
*/

'use strict';

var obsidian = require('obsidian');

// Remove Widgets in CodeMirror Editor
const clearWidges = (cm) => {
    var lastLine = cm.lastLine();
    for (let i = 0; i <= lastLine; i++) {
        // Get the current Line
        const line = cm.lineInfo(i);
        // Clear the image widgets if exists
        if (line.widgets) {
            for (const wid of line.widgets) {
                if (wid.className === 'oz-image-widget') {
                    wid.clear();
                }
            }
        }
    }
};
// Http, Https Link Check
const filename_is_a_link = (filename) => {
    const url_regex = /^[a-z][a-z0-9+\-.]+:/i;
    return filename.match(url_regex) != null;
};
// Image Name and Alt Text
const getFileNameAndAltText = (linkType, match) => {
    /*
       linkType 1: [[myimage.jpg|#x-small]]
       linkType2: ![#x-small](myimage.jpg)
       returns { fileName: '', altText: '' }
    */
    var file_name_regex;
    var alt_regex;
    if (linkType == 1) {
        file_name_regex = /(?<=\[\[).*(jpe?g|png|gif|svg)/;
        alt_regex = /(?<=\|).*(?=]])/;
    }
    else if (linkType == 2) {
        file_name_regex = /(?<=\().*(jpe?g|png|gif|svg)/;
        alt_regex = /(?<=\[)(^$|.*)(?=\])/;
    }
    var file_match = match[0].match(file_name_regex);
    var alt_match = match[0].match(alt_regex);
    return { fileName: file_match ? file_match[0] : '',
        altText: alt_match ? alt_match[0] : '' };
};
// Getting Active Markdown File
const getActiveNoteFile = (workspace) => {
    return workspace.getActiveFile();
};
const getPathOfVault = (vault) => {
    var path = vault.adapter.basePath;
    if (path.startsWith('/'))
        return 'app://local' + path;
    return 'app://local/' + path;
};
// Temporary Solution until getResourcePath improved 
const getPathOfImage = (vault, image) => {
    // vault.getResourcePath(image) 
    return getPathOfVault(vault) + '/' + image.path;
};
const getFileCmBelongsTo = (cm, workspace) => {
    var _a;
    let leafs = workspace.getLeavesOfType("markdown");
    for (let i = 0; i < leafs.length; i++) {
        if (((_a = leafs[i].view.sourceMode) === null || _a === void 0 ? void 0 : _a.cmEditor) == cm) {
            return leafs[i].view.file;
        }
    }
    return null;
};

class OzanImagePlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        // Line Edit Changes
        this.codemirrorLineChanges = (cm, change) => {
            this.check_lines(cm, change.from.line, change.from.line + change.text.length - 1);
        };
        // Only Triggered during initial Load
        this.handleInitialLoad = (cm) => {
            var lastLine = cm.lastLine();
            var file = getFileCmBelongsTo(cm, this.app.workspace);
            for (let i = 0; i < lastLine; i++) {
                this.check_line(cm, i, file);
            }
        };
        // Check Single Line
        this.check_line = (cm, line_number, targetFile) => {
            // Regex for [[ ]] format
            const image_line_regex_1 = /!\[\[.*(jpe?g|png|gif|svg).*\]\]/;
            // Regex for ![ ]( ) format
            const image_line_regex_2 = /!\[(^$|.*)\]\(.*(jpe?g|png|gif|svg)\)/;
            // Get the Line edited
            const line = cm.lineInfo(line_number);
            if (line === null)
                return;
            // Current Line Comparison with Regex
            const match_1 = line.text.match(image_line_regex_1);
            const match_2 = line.text.match(image_line_regex_2);
            // Clear the widget if link was removed
            var line_image_widget = line.widgets ? line.widgets.filter((wid) => wid.className === 'oz-image-widget') : false;
            if (line_image_widget && (!match_1 || !match_2))
                line_image_widget[0].clear();
            // If any of regex matches, it will add image widget
            if (match_1 || match_2) {
                // Clear the image widgets if exists
                if (line.widgets) {
                    for (const wid of line.widgets) {
                        if (wid.className === 'oz-image-widget') {
                            wid.clear();
                        }
                    }
                }
                // Get the file name and alt text depending on format
                var filename = '';
                var alt = '';
                if (match_1) {
                    // Regex for [[myimage.jpg|#x-small]] format
                    filename = getFileNameAndAltText(1, match_1).fileName;
                    alt = getFileNameAndAltText(1, match_1).altText;
                }
                else if (match_2) {
                    // Regex for ![#x-small](myimage.jpg) format
                    filename = getFileNameAndAltText(2, match_2).fileName;
                    alt = getFileNameAndAltText(2, match_2).altText;
                }
                // Create Image
                const img = document.createElement('img');
                // Prepare the src for the Image
                if (filename_is_a_link(filename)) {
                    img.src = filename;
                }
                else {
                    // Source Path
                    var sourcePath = '';
                    if (targetFile != null) {
                        sourcePath = targetFile.path;
                    }
                    else {
                        let activeNoteFile = getActiveNoteFile(this.app.workspace);
                        sourcePath = activeNoteFile ? activeNoteFile.path : '';
                    }
                    var image = this.app.metadataCache.getFirstLinkpathDest(decodeURIComponent(filename), sourcePath);
                    if (image != null)
                        img.src = getPathOfImage(this.app.vault, image);
                }
                // Image Properties
                img.alt = alt;
                // Add Image widget under the Image Markdown
                cm.addLineWidget(line_number, img, { className: 'oz-image-widget' });
            }
        };
        // Check All Lines Function
        this.check_lines = (cm, from, to) => {
            // Last Used Line Number in Code Mirror
            var file = getFileCmBelongsTo(cm, this.app.workspace);
            for (let i = from; i <= to; i++) {
                this.check_line(cm, i, file);
            }
        };
    }
    onload() {
        // Register event for each change
        this.registerCodeMirror((cm) => {
            cm.on("change", this.codemirrorLineChanges);
            this.handleInitialLoad(cm);
        });
    }
    onunload() {
        this.app.workspace.iterateCodeMirrors((cm) => {
            cm.off("change", this.codemirrorLineChanges);
            clearWidges(cm);
        });
        new obsidian.Notice('Image in Editor Plugin is unloaded');
    }
}

module.exports = OzanImagePlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL3V0aWxzLnRzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgV29ya3NwYWNlLCBNYXJrZG93blZpZXcsIFZhdWx0LCBURmlsZSwgbm9ybWFsaXplUGF0aCB9IGZyb20gJ29ic2lkaWFuJztcblxuLy8gUmVtb3ZlIFdpZGdldHMgaW4gQ29kZU1pcnJvciBFZGl0b3JcbmNvbnN0IGNsZWFyV2lkZ2VzID0gKGNtOiBDb2RlTWlycm9yLkVkaXRvcikgPT4ge1xuICAgIHZhciBsYXN0TGluZSA9IGNtLmxhc3RMaW5lKCk7XG5cbiAgICBmb3IobGV0IGk9MDsgaSA8PSBsYXN0TGluZTsgaSsrKXtcbiAgICAgICAgLy8gR2V0IHRoZSBjdXJyZW50IExpbmVcbiAgICAgICAgY29uc3QgbGluZSA9IGNtLmxpbmVJbmZvKGkpO1xuICAgICAgICAvLyBDbGVhciB0aGUgaW1hZ2Ugd2lkZ2V0cyBpZiBleGlzdHNcbiAgICAgICAgaWYgKGxpbmUud2lkZ2V0cyl7XG4gICAgICAgICAgICBmb3IoY29uc3Qgd2lkIG9mIGxpbmUud2lkZ2V0cyl7XG4gICAgICAgICAgICAgICAgaWYgKHdpZC5jbGFzc05hbWUgPT09ICdvei1pbWFnZS13aWRnZXQnKXtcbiAgICAgICAgICAgICAgICAgICAgd2lkLmNsZWFyKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIEh0dHAsIEh0dHBzIExpbmsgQ2hlY2tcbmNvbnN0IGZpbGVuYW1lX2lzX2FfbGluayA9IChmaWxlbmFtZTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgdXJsX3JlZ2V4ID0gL15bYS16XVthLXowLTkrXFwtLl0rOi9pXG4gICAgcmV0dXJuIGZpbGVuYW1lLm1hdGNoKHVybF9yZWdleCkgIT0gbnVsbFxufTtcblxuIC8vIEltYWdlIE5hbWUgYW5kIEFsdCBUZXh0XG5jb25zdCBnZXRGaWxlTmFtZUFuZEFsdFRleHQgPShsaW5rVHlwZTogbnVtYmVyLCBtYXRjaDogYW55KSA9PiB7XG4gICAgLyogXG4gICAgICAgbGlua1R5cGUgMTogW1tteWltYWdlLmpwZ3wjeC1zbWFsbF1dXG4gICAgICAgbGlua1R5cGUyOiAhWyN4LXNtYWxsXShteWltYWdlLmpwZykgXG4gICAgICAgcmV0dXJucyB7IGZpbGVOYW1lOiAnJywgYWx0VGV4dDogJycgfSAgIFxuICAgICovXG5cbiAgICB2YXIgZmlsZV9uYW1lX3JlZ2V4O1xuICAgIHZhciBhbHRfcmVnZXg7XG5cbiAgICBpZihsaW5rVHlwZSA9PSAxKXtcbiAgICAgICAgZmlsZV9uYW1lX3JlZ2V4ID0gLyg/PD1cXFtcXFspLiooanBlP2d8cG5nfGdpZnxzdmcpLztcbiAgICAgICAgYWx0X3JlZ2V4ID0gLyg/PD1cXHwpLiooPz1dXSkvO1xuICAgIH0gZWxzZSBpZihsaW5rVHlwZSA9PSAyKXtcbiAgICAgICAgZmlsZV9uYW1lX3JlZ2V4ID0gLyg/PD1cXCgpLiooanBlP2d8cG5nfGdpZnxzdmcpLztcbiAgICAgICAgYWx0X3JlZ2V4ID0gLyg/PD1cXFspKF4kfC4qKSg/PVxcXSkvO1xuICAgIH1cblxuICAgIHZhciBmaWxlX21hdGNoID0gbWF0Y2hbMF0ubWF0Y2goZmlsZV9uYW1lX3JlZ2V4KTtcbiAgICB2YXIgYWx0X21hdGNoID0gbWF0Y2hbMF0ubWF0Y2goYWx0X3JlZ2V4KTtcblxuICAgIHJldHVybiB7IGZpbGVOYW1lOiBmaWxlX21hdGNoID8gZmlsZV9tYXRjaFswXSA6ICcnLCBcbiAgICAgICAgICAgIGFsdFRleHQ6IGFsdF9tYXRjaCA/IGFsdF9tYXRjaFswXSA6ICcnIH1cblxufSAgICBcblxuLy8gR2V0dGluZyBBY3RpdmUgTWFya2Rvd24gRmlsZVxuY29uc3QgZ2V0QWN0aXZlTm90ZUZpbGUgPSAod29ya3NwYWNlOiBXb3Jrc3BhY2UpID0+IHtcbiAgICByZXR1cm4gd29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbn1cblxuLy8gR2V0IEFjdGl2ZSBFZGl0b3JcbmNvbnN0IGdldENtRWRpdG9yID0gKHdvcmtzcGFjZTogV29ya3NwYWNlKTogQ29kZU1pcnJvci5FZGl0b3IgPT4ge1xuICAgIHJldHVybiB3b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpPy5zb3VyY2VNb2RlPy5jbUVkaXRvclxufVxuXG5jb25zdCBnZXRQYXRoT2ZWYXVsdCA9ICh2YXVsdDogVmF1bHQpOiBzdHJpbmcgPT4ge1xuICAgIHZhciBwYXRoID0gdmF1bHQuYWRhcHRlci5iYXNlUGF0aDtcbiAgICBpZihwYXRoLnN0YXJ0c1dpdGgoJy8nKSkgcmV0dXJuICdhcHA6Ly9sb2NhbCcgKyBwYXRoXG4gICAgcmV0dXJuICdhcHA6Ly9sb2NhbC8nICsgcGF0aFxufVxuXG4vLyBUZW1wb3JhcnkgU29sdXRpb24gdW50aWwgZ2V0UmVzb3VyY2VQYXRoIGltcHJvdmVkIFxuY29uc3QgZ2V0UGF0aE9mSW1hZ2UgPSAodmF1bHQ6IFZhdWx0LCBpbWFnZTogVEZpbGUpID0+IHtcbiAgICAvLyB2YXVsdC5nZXRSZXNvdXJjZVBhdGgoaW1hZ2UpIFxuICAgIHJldHVybiBnZXRQYXRoT2ZWYXVsdCh2YXVsdCkgKyAnLycgKyBpbWFnZS5wYXRoXG59XG5cbmNvbnN0IGdldEZpbGVDbUJlbG9uZ3NUbyA9IChjbTogQ29kZU1pcnJvci5FZGl0b3IsIHdvcmtzcGFjZTogV29ya3NwYWNlKSA9PiB7XG4gICAgbGV0IGxlYWZzID0gd29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcIm1hcmtkb3duXCIpO1xuICAgIGZvcihsZXQgaT0wOyBpIDwgbGVhZnMubGVuZ3RoOyBpKyspe1xuICAgICAgICBpZihsZWFmc1tpXS52aWV3LnNvdXJjZU1vZGU/LmNtRWRpdG9yID09IGNtKXtcbiAgICAgICAgICAgIHJldHVybiBsZWFmc1tpXS52aWV3LmZpbGVcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn0gXG5cbmV4cG9ydCB7IGNsZWFyV2lkZ2VzLCBmaWxlbmFtZV9pc19hX2xpbmssIGdldEZpbGVOYW1lQW5kQWx0VGV4dCxcbiAgICBnZXRBY3RpdmVOb3RlRmlsZSwgZ2V0Q21FZGl0b3IsIGdldFBhdGhPZkltYWdlLCBnZXRGaWxlQ21CZWxvbmdzVG8gfTsiLCJpbXBvcnQgeyBQbHVnaW4sIE5vdGljZSwgVEZpbGUgfSBmcm9tICdvYnNpZGlhbic7XG5pbXBvcnQgeyBjbGVhcldpZGdlcywgZmlsZW5hbWVfaXNfYV9saW5rLCBnZXRGaWxlTmFtZUFuZEFsdFRleHQsXG4gICAgICAgIGdldEFjdGl2ZU5vdGVGaWxlLCBnZXRQYXRoT2ZJbWFnZSwgZ2V0RmlsZUNtQmVsb25nc1RvIH0gZnJvbSAnLi91dGlscyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE96YW5JbWFnZVBsdWdpbiBleHRlbmRzIFBsdWdpbntcblxuICAgIG9ubG9hZCgpe1xuICAgICAgICAvLyBSZWdpc3RlciBldmVudCBmb3IgZWFjaCBjaGFuZ2VcbiAgICAgICAgdGhpcy5yZWdpc3RlckNvZGVNaXJyb3IoIChjbTogQ29kZU1pcnJvci5FZGl0b3IpID0+IHtcbiAgICAgICAgICAgIGNtLm9uKFwiY2hhbmdlXCIsIHRoaXMuY29kZW1pcnJvckxpbmVDaGFuZ2VzKTtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlSW5pdGlhbExvYWQoY20pO1xuICAgICAgICB9KVxuICAgIH1cblxuICAgIG9udW5sb2FkKCl7XG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5pdGVyYXRlQ29kZU1pcnJvcnMoIChjbSkgPT4ge1xuICAgICAgICAgICAgY20ub2ZmKFwiY2hhbmdlXCIsIHRoaXMuY29kZW1pcnJvckxpbmVDaGFuZ2VzKTtcbiAgICAgICAgICAgIGNsZWFyV2lkZ2VzKGNtKTtcbiAgICAgICAgfSk7XG4gICAgICAgIG5ldyBOb3RpY2UoJ0ltYWdlIGluIEVkaXRvciBQbHVnaW4gaXMgdW5sb2FkZWQnKTtcbiAgICB9XG5cbiAgICAvLyBMaW5lIEVkaXQgQ2hhbmdlc1xuICAgIGNvZGVtaXJyb3JMaW5lQ2hhbmdlcyA9IChjbTogYW55LCBjaGFuZ2U6IGFueSkgPT4ge1xuICAgICAgICB0aGlzLmNoZWNrX2xpbmVzKGNtLCBjaGFuZ2UuZnJvbS5saW5lLCBjaGFuZ2UuZnJvbS5saW5lICsgY2hhbmdlLnRleHQubGVuZ3RoIC0gMSk7XG4gICAgfVxuXG4gICAgLy8gT25seSBUcmlnZ2VyZWQgZHVyaW5nIGluaXRpYWwgTG9hZFxuICAgIGhhbmRsZUluaXRpYWxMb2FkID0gKGNtOiBDb2RlTWlycm9yLkVkaXRvcikgPT4ge1xuICAgICAgICB2YXIgbGFzdExpbmUgPSBjbS5sYXN0TGluZSgpO1xuICAgICAgICB2YXIgZmlsZSA9IGdldEZpbGVDbUJlbG9uZ3NUbyhjbSwgdGhpcy5hcHAud29ya3NwYWNlKTtcbiAgICAgICAgZm9yKGxldCBpPTA7IGkgPCBsYXN0TGluZTsgaSsrKXtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tfbGluZShjbSwgaSwgZmlsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDaGVjayBTaW5nbGUgTGluZVxuICAgIGNoZWNrX2xpbmU6IGFueSA9IChjbTogQ29kZU1pcnJvci5FZGl0b3IsIGxpbmVfbnVtYmVyOiBudW1iZXIsIHRhcmdldEZpbGU6VEZpbGUpID0+IHtcblxuICAgICAgICAvLyBSZWdleCBmb3IgW1sgXV0gZm9ybWF0XG4gICAgICAgIGNvbnN0IGltYWdlX2xpbmVfcmVnZXhfMSA9IC8hXFxbXFxbLiooanBlP2d8cG5nfGdpZnxzdmcpLipcXF1cXF0vXG4gICAgICAgIC8vIFJlZ2V4IGZvciAhWyBdKCApIGZvcm1hdFxuICAgICAgICBjb25zdCBpbWFnZV9saW5lX3JlZ2V4XzIgPSAvIVxcWyheJHwuKilcXF1cXCguKihqcGU/Z3xwbmd8Z2lmfHN2ZylcXCkvXG4gICAgICAgIC8vIEdldCB0aGUgTGluZSBlZGl0ZWRcbiAgICAgICAgY29uc3QgbGluZSA9IGNtLmxpbmVJbmZvKGxpbmVfbnVtYmVyKTtcbiAgICAgICAgXG4gICAgICAgIGlmKGxpbmUgPT09IG51bGwpIHJldHVybjtcblxuICAgICAgICAvLyBDdXJyZW50IExpbmUgQ29tcGFyaXNvbiB3aXRoIFJlZ2V4XG4gICAgICAgIGNvbnN0IG1hdGNoXzEgPSBsaW5lLnRleHQubWF0Y2goaW1hZ2VfbGluZV9yZWdleF8xKTtcbiAgICAgICAgY29uc3QgbWF0Y2hfMiA9IGxpbmUudGV4dC5tYXRjaChpbWFnZV9saW5lX3JlZ2V4XzIpO1xuXG4gICAgICAgIC8vIENsZWFyIHRoZSB3aWRnZXQgaWYgbGluayB3YXMgcmVtb3ZlZFxuICAgICAgICB2YXIgbGluZV9pbWFnZV93aWRnZXQgPSBsaW5lLndpZGdldHMgPyBsaW5lLndpZGdldHMuZmlsdGVyKCh3aWQ6IHsgY2xhc3NOYW1lOiBzdHJpbmc7IH0pID0+IHdpZC5jbGFzc05hbWUgPT09ICdvei1pbWFnZS13aWRnZXQnKSA6IGZhbHNlO1xuICAgICAgICBpZihsaW5lX2ltYWdlX3dpZGdldCAmJiAoIW1hdGNoXzEgfHwgIW1hdGNoXzIpKSBsaW5lX2ltYWdlX3dpZGdldFswXS5jbGVhcigpO1xuXG4gICAgICAgIC8vIElmIGFueSBvZiByZWdleCBtYXRjaGVzLCBpdCB3aWxsIGFkZCBpbWFnZSB3aWRnZXRcbiAgICAgICAgaWYobWF0Y2hfMSB8fCBtYXRjaF8yKXtcbiAgICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENsZWFyIHRoZSBpbWFnZSB3aWRnZXRzIGlmIGV4aXN0c1xuICAgICAgICAgICAgaWYgKGxpbmUud2lkZ2V0cyl7XG4gICAgICAgICAgICAgICAgZm9yKGNvbnN0IHdpZCBvZiBsaW5lLndpZGdldHMpe1xuICAgICAgICAgICAgICAgICAgICBpZiAod2lkLmNsYXNzTmFtZSA9PT0gJ296LWltYWdlLXdpZGdldCcpe1xuICAgICAgICAgICAgICAgICAgICAgICAgd2lkLmNsZWFyKClcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gR2V0IHRoZSBmaWxlIG5hbWUgYW5kIGFsdCB0ZXh0IGRlcGVuZGluZyBvbiBmb3JtYXRcbiAgICAgICAgICAgIHZhciBmaWxlbmFtZSA9ICcnO1xuICAgICAgICAgICAgdmFyIGFsdCA9ICcnO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZihtYXRjaF8xKXtcbiAgICAgICAgICAgICAgICAvLyBSZWdleCBmb3IgW1tteWltYWdlLmpwZ3wjeC1zbWFsbF1dIGZvcm1hdFxuICAgICAgICAgICAgICAgIGZpbGVuYW1lID0gZ2V0RmlsZU5hbWVBbmRBbHRUZXh0KDEsIG1hdGNoXzEpLmZpbGVOYW1lXG4gICAgICAgICAgICAgICAgYWx0ID0gZ2V0RmlsZU5hbWVBbmRBbHRUZXh0KDEsIG1hdGNoXzEpLmFsdFRleHRcbiAgICAgICAgICAgIH0gZWxzZSBpZihtYXRjaF8yKXtcbiAgICAgICAgICAgICAgICAvLyBSZWdleCBmb3IgIVsjeC1zbWFsbF0obXlpbWFnZS5qcGcpIGZvcm1hdFxuICAgICAgICAgICAgICAgIGZpbGVuYW1lID0gZ2V0RmlsZU5hbWVBbmRBbHRUZXh0KDIsIG1hdGNoXzIpLmZpbGVOYW1lXG4gICAgICAgICAgICAgICAgYWx0ID0gZ2V0RmlsZU5hbWVBbmRBbHRUZXh0KDIsIG1hdGNoXzIpLmFsdFRleHRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQ3JlYXRlIEltYWdlXG4gICAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcblxuICAgICAgICAgICAgLy8gUHJlcGFyZSB0aGUgc3JjIGZvciB0aGUgSW1hZ2VcbiAgICAgICAgICAgIGlmKGZpbGVuYW1lX2lzX2FfbGluayhmaWxlbmFtZSkpe1xuICAgICAgICAgICAgICAgIGltZy5zcmMgPSBmaWxlbmFtZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gU291cmNlIFBhdGhcbiAgICAgICAgICAgICAgICB2YXIgc291cmNlUGF0aCA9ICcnO1xuICAgICAgICAgICAgICAgIGlmKHRhcmdldEZpbGUgIT0gbnVsbCl7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGggPSB0YXJnZXRGaWxlLnBhdGg7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIGxldCBhY3RpdmVOb3RlRmlsZSA9IGdldEFjdGl2ZU5vdGVGaWxlKHRoaXMuYXBwLndvcmtzcGFjZSk7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGggPSBhY3RpdmVOb3RlRmlsZSA/IGFjdGl2ZU5vdGVGaWxlLnBhdGggOiAnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIGltYWdlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChkZWNvZGVVUklDb21wb25lbnQoZmlsZW5hbWUpLCBzb3VyY2VQYXRoKTtcbiAgICAgICAgICAgICAgICBpZihpbWFnZSAhPSBudWxsKSBpbWcuc3JjID0gZ2V0UGF0aE9mSW1hZ2UodGhpcy5hcHAudmF1bHQsIGltYWdlKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJbWFnZSBQcm9wZXJ0aWVzXG4gICAgICAgICAgICBpbWcuYWx0ID0gYWx0O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBBZGQgSW1hZ2Ugd2lkZ2V0IHVuZGVyIHRoZSBJbWFnZSBNYXJrZG93blxuICAgICAgICAgICAgY20uYWRkTGluZVdpZGdldChsaW5lX251bWJlciwgaW1nLCB7Y2xhc3NOYW1lOiAnb3otaW1hZ2Utd2lkZ2V0J30pOyAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgQWxsIExpbmVzIEZ1bmN0aW9uXG4gICAgY2hlY2tfbGluZXM6IGFueSA9IChjbTogQ29kZU1pcnJvci5FZGl0b3IsIGZyb206IG51bWJlciwgdG86IG51bWJlcikgPT4ge1xuICAgICAgICAvLyBMYXN0IFVzZWQgTGluZSBOdW1iZXIgaW4gQ29kZSBNaXJyb3JcbiAgICAgICAgdmFyIGZpbGUgPSBnZXRGaWxlQ21CZWxvbmdzVG8oY20sIHRoaXMuYXBwLndvcmtzcGFjZSk7XG4gICAgICAgIGZvcihsZXQgaT1mcm9tOyBpIDw9IHRvOyBpKyspe1xuICAgICAgICAgICAgdGhpcy5jaGVja19saW5lKGNtLCBpLCBmaWxlKTtcbiAgICAgICAgfVxuICAgIH1cbn0iXSwibmFtZXMiOlsiUGx1Z2luIiwiTm90aWNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFFQTtBQUNBLE1BQU0sV0FBVyxHQUFHLENBQUMsRUFBcUI7SUFDdEMsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRTdCLEtBQUksSUFBSSxDQUFDLEdBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUM7O1FBRTVCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7O1FBRTVCLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBQztZQUNiLEtBQUksTUFBTSxHQUFHLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBQztnQkFDMUIsSUFBSSxHQUFHLENBQUMsU0FBUyxLQUFLLGlCQUFpQixFQUFDO29CQUNwQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUE7aUJBQ2Q7YUFDSjtTQUNKO0tBQ0o7QUFDTCxDQUFDLENBQUE7QUFFRDtBQUNBLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxRQUFnQjtJQUN4QyxNQUFNLFNBQVMsR0FBRyx1QkFBdUIsQ0FBQTtJQUN6QyxPQUFPLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFBO0FBQzVDLENBQUMsQ0FBQztBQUVEO0FBQ0QsTUFBTSxxQkFBcUIsR0FBRSxDQUFDLFFBQWdCLEVBQUUsS0FBVTs7Ozs7O0lBT3RELElBQUksZUFBZSxDQUFDO0lBQ3BCLElBQUksU0FBUyxDQUFDO0lBRWQsSUFB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