'use strict';

var obsidian = require('obsidian');

function forOwn(object, callback) {
    if ((typeof object === 'object') && (typeof callback === 'function')) {
        for (var key in object) {
            if (object.hasOwnProperty(key) === true) {
                if (callback(key, object[key]) === false) {
                    break;
                }
            }
        }
    }
}

var lib = (function () {
    var self = {
        count: 0,
        edges: {},
        nodes: {}
    };

    self.link = function (source, target, weight) {
        if ((isFinite(weight) !== true) || (weight === null)) {
            weight = 1;
        }
        
        weight = parseFloat(weight);

        if (self.nodes.hasOwnProperty(source) !== true) {
            self.count++;
            self.nodes[source] = {
                weight: 0,
                outbound: 0
            };
        }

        self.nodes[source].outbound += weight;

        if (self.nodes.hasOwnProperty(target) !== true) {
            self.count++;
            self.nodes[target] = {
                weight: 0,
                outbound: 0
            };
        }

        if (self.edges.hasOwnProperty(source) !== true) {
            self.edges[source] = {};
        }

        if (self.edges[source].hasOwnProperty(target) !== true) {
            self.edges[source][target] = 0;
        }

        self.edges[source][target] += weight;
    };

    self.rank = function (alpha, epsilon, callback) {
        var delta = 1,
            inverse = 1 / self.count;

        forOwn(self.edges, function (source) {
            if (self.nodes[source].outbound > 0) {
                forOwn(self.edges[source], function (target) {
                    self.edges[source][target] /= self.nodes[source].outbound;
                });
            }
        });

        forOwn(self.nodes, function (key) {
            self.nodes[key].weight = inverse;
        });

        while (delta > epsilon) {
            var leak = 0,
                nodes = {};

            forOwn(self.nodes, function (key, value) {
                nodes[key] = value.weight;

                if (value.outbound === 0) {
                    leak += value.weight;
                }

                self.nodes[key].weight = 0;
            });

            leak *= alpha;

            forOwn(self.nodes, function (source) {
                forOwn(self.edges[source], function (target, weight) {
                    self.nodes[target].weight += alpha * nodes[source] * weight;
                });

                self.nodes[source].weight += (1 - alpha) * inverse + leak * inverse;
            });

            delta = 0;

            forOwn(self.nodes, function (key, value) {
                delta += Math.abs(value.weight - nodes[key]);
            });
        }

        forOwn(self.nodes, function (key) {
            return callback(key, self.nodes[key].weight);
        });
    };

    self.reset = function () {
        self.count = 0;
        self.edges = {};
        self.nodes = {};
    };

    return self;
})();

const DEFAULT_SETTINGS = {
    baseEase: 250,
    maxLinkFactor: 1.0,
    openRandomNote: false,
    lapsesIntervalChange: 0.5,
    autoNextNote: false,
    tagsToReview: ["#review"],
    flashcardsTag: "#flashcards",
    singleLineCommentOnSameLine: false,
};
class SRSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName("Flashcards tag")
            .setDesc("Enter one tag i.e. #flashcards.")
            .addText((text) => text
            .setValue(`${this.plugin.data.settings.flashcardsTag}`)
            .onChange(async (value) => {
            this.plugin.data.settings.flashcardsTag = value;
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Tags to review")
            .setDesc("Enter tags separated by spaces i.e. #review #tag2 #tag3.")
            .addTextArea((text) => text
            .setValue(`${this.plugin.data.settings.tagsToReview.join(" ")}`)
            .onChange(async (value) => {
            this.plugin.data.settings.tagsToReview = value.split(" ");
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Save comment for single-line notes on the same line?")
            .setDesc("Turning this on will make the HTML comments not break list formatting")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.singleLineCommentOnSameLine)
            .onChange(async (value) => {
            this.plugin.data.settings.singleLineCommentOnSameLine = value;
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Open a random note for review")
            .setDesc("When you turn this off, notes are ordered by importance (PageRank)")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.openRandomNote)
            .onChange(async (value) => {
            this.plugin.data.settings.openRandomNote = value;
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Open next note automatically after a review")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.autoNextNote)
            .onChange(async (value) => {
            this.plugin.data.settings.autoNextNote = value;
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Base ease")
            .setDesc("minimum = 130, preferrably approximately 250")
            .addText((text) => text
            .setValue(`${this.plugin.data.settings.baseEase}`)
            .onChange(async (value) => {
            let numValue = Number.parseInt(value);
            if (!isNaN(numValue)) {
                if (numValue < 130) {
                    new obsidian.Notice("The base ease must be at least 130.");
                    text.setValue(`${this.plugin.data.settings.baseEase}`);
                    return;
                }
                this.plugin.data.settings.baseEase = numValue;
                await this.plugin.savePluginData();
            }
            else {
                new obsidian.Notice("Please provide a valid number.");
            }
        }));
        new obsidian.Setting(containerEl)
            .setName("Interval change when you review a note/concept as hard")
            .setDesc("newInterval = oldInterval * intervalChange / 100, 0% < intervalChange < 100%")
            .addText((text) => text
            .setValue(`${this.plugin.data.settings.lapsesIntervalChange * 100}`)
            .onChange(async (value) => {
            let numValue = Number.parseInt(value) / 100;
            if (!isNaN(numValue)) {
                if (numValue < 0.01 || numValue > 0.99) {
                    new obsidian.Notice("The load balancing threshold must be in the range 0% < intervalChange < 100%.");
                    text.setValue(`${this.plugin.data.settings
                        .lapsesIntervalChange * 100}`);
                    return;
                }
                this.plugin.data.settings.lapsesIntervalChange = numValue;
                await this.plugin.savePluginData();
            }
            else {
                new obsidian.Notice("Please provide a valid number.");
            }
        }));
        new obsidian.Setting(containerEl)
            .setName("Maximum link contribution")
            .setDesc("Max. contribution of the weighted ease of linked notes to the initial ease (0% <= maxLinkFactor <= 100%)")
            .addText((text) => text
            .setValue(`${this.plugin.data.settings.maxLinkFactor * 100}`)
            .onChange(async (value) => {
            let numValue = Number.parseInt(value) / 100;
            if (!isNaN(numValue)) {
                if (numValue < 0 || numValue > 1.0) {
                    new obsidian.Notice("The link factor must be in the range 0% <= maxLinkFactor <= 100%.");
                    text.setValue(`${this.plugin.data.settings
                        .maxLinkFactor * 100}`);
                    return;
                }
                this.plugin.data.settings.maxLinkFactor = numValue;
                await this.plugin.savePluginData();
            }
            else {
                new obsidian.Notice("Please provide a valid number.");
            }
        }));
        let helpEl = containerEl.createDiv("sr-help-div");
        helpEl.innerHTML =
            '<a href="https://github.com/st3v3nmw/obsidian-spaced-repetition/blob/master/README.md">For more information, check the README.</a>';
    }
}

var UserResponse;
(function (UserResponse) {
    UserResponse[UserResponse["ShowAnswer"] = 0] = "ShowAnswer";
    UserResponse[UserResponse["ReviewHard"] = 1] = "ReviewHard";
    UserResponse[UserResponse["ReviewGood"] = 2] = "ReviewGood";
    UserResponse[UserResponse["ReviewEasy"] = 3] = "ReviewEasy";
    UserResponse[UserResponse["Skip"] = 4] = "Skip";
})(UserResponse || (UserResponse = {}));
var Mode;
(function (Mode) {
    Mode[Mode["Front"] = 0] = "Front";
    Mode[Mode["Back"] = 1] = "Back";
    Mode[Mode["Closed"] = 2] = "Closed";
})(Mode || (Mode = {}));
class FlashcardModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.titleEl.setText("Queue");
        this.modalEl.style.height = "80%";
        this.modalEl.style.width = "40%";
        this.contentEl.style.position = "relative";
        this.contentEl.style.height = "92%";
        this.fileLinkView = createDiv("sr-link");
        this.fileLinkView.setText("Open file");
        this.fileLinkView.addEventListener("click", (_) => {
            this.close();
            this.plugin.app.workspace.activeLeaf.openFile(this.currentCard.note);
        });
        this.contentEl.appendChild(this.fileLinkView);
        this.contextView = document.createElement("div");
        this.contextView.setAttribute("id", "sr-context");
        this.contentEl.appendChild(this.contextView);
        this.flashcardView = document.createElement("div");
        this.contentEl.appendChild(this.flashcardView);
        this.responseDiv = createDiv("sr-response");
        this.hardBtn = document.createElement("button");
        this.hardBtn.setAttribute("id", "sr-hard-btn");
        this.hardBtn.setText("Hard");
        this.hardBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ReviewHard);
        });
        this.responseDiv.appendChild(this.hardBtn);
        this.goodBtn = document.createElement("button");
        this.goodBtn.setAttribute("id", "sr-good-btn");
        this.goodBtn.setText("Good");
        this.goodBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ReviewGood);
        });
        this.responseDiv.appendChild(this.goodBtn);
        this.easyBtn = document.createElement("button");
        this.easyBtn.setAttribute("id", "sr-easy-btn");
        this.easyBtn.setText("Easy");
        this.easyBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ReviewEasy);
        });
        this.responseDiv.appendChild(this.easyBtn);
        this.responseDiv.style.display = "none";
        this.contentEl.appendChild(this.responseDiv);
        this.answerBtn = document.createElement("div");
        this.answerBtn.setAttribute("id", "sr-show-answer");
        this.answerBtn.setText("Show Answer");
        this.answerBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ShowAnswer);
        });
        this.contentEl.appendChild(this.answerBtn);
        document.body.onkeypress = (e) => {
            if (this.mode != Mode.Closed && e.code == "KeyS") {
                this.processResponse(UserResponse.Skip);
            }
            else if (this.mode == Mode.Front &&
                (e.code == "Space" || e.code == "Enter"))
                this.processResponse(UserResponse.ShowAnswer);
            else if (this.mode == Mode.Back) {
                if (e.code == "Numpad1" || e.code == "Digit1")
                    this.processResponse(UserResponse.ReviewHard);
                else if (e.code == "Numpad2" || e.code == "Digit2")
                    this.processResponse(UserResponse.ReviewGood);
                else if (e.code == "Numpad3" || e.code == "Digit3")
                    this.processResponse(UserResponse.ReviewEasy);
            }
        };
    }
    onOpen() {
        this.nextCard();
    }
    onClose() {
        this.mode = Mode.Closed;
    }
    nextCard() {
        this.responseDiv.style.display = "none";
        let count = this.plugin.newFlashcards.length + this.plugin.dueFlashcards.length;
        this.titleEl.setText(`Queue - ${count}`);
        if (count == 0) {
            this.fileLinkView.innerHTML = "";
            this.contextView.innerHTML = "";
            this.flashcardView.innerHTML =
                "<h3 style='text-align: center; margin-top: 50%;'>You're done for the day :D.</h3>";
            return;
        }
        this.answerBtn.style.display = "initial";
        this.flashcardView.innerHTML = "";
        this.mode = Mode.Front;
        if (this.plugin.dueFlashcards.length > 0) {
            this.currentCard = this.plugin.dueFlashcards[0];
            obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.front, this.flashcardView, this.currentCard.note.path, this.plugin);
            let hardInterval = this.nextState(UserResponse.ReviewHard, this.currentCard.interval, this.currentCard.ease).interval;
            let goodInterval = this.nextState(UserResponse.ReviewGood, this.currentCard.interval, this.currentCard.ease).interval;
            let easyInterval = this.nextState(UserResponse.ReviewEasy, this.currentCard.interval, this.currentCard.ease).interval;
            this.hardBtn.setText(`Hard - ${hardInterval} day(s)`);
            this.goodBtn.setText(`Good - ${goodInterval} day(s)`);
            this.easyBtn.setText(`Easy - ${easyInterval} day(s)`);
        }
        else if (this.plugin.newFlashcards.length > 0) {
            this.currentCard = this.plugin.newFlashcards[0];
            obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.front, this.flashcardView, this.currentCard.note.path, this.plugin);
            this.hardBtn.setText("Hard - 1.0 day(s)");
            this.goodBtn.setText("Good - 2.5 day(s)");
            this.easyBtn.setText("Easy - 3.5 day(s)");
        }
        this.contextView.setText(this.currentCard.context);
    }
    async processResponse(response) {
        if (response == UserResponse.ShowAnswer) {
            this.mode = Mode.Back;
            this.answerBtn.style.display = "none";
            this.responseDiv.style.display = "grid";
            let hr = document.createElement("hr");
            hr.setAttribute("id", "sr-hr-card-divide");
            this.flashcardView.appendChild(hr);
            obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.back, this.flashcardView, this.currentCard.note.path, this.plugin);
        }
        else if (response == UserResponse.ReviewHard ||
            response == UserResponse.ReviewGood ||
            response == UserResponse.ReviewEasy) {
            let intervalOuter, easeOuter;
            // scheduled card
            if (this.currentCard.due) {
                this.plugin.dueFlashcards.splice(0, 1);
                let { interval, ease } = this.nextState(response, this.currentCard.interval, this.currentCard.ease);
                // don't look too closely lol
                intervalOuter = interval;
                easeOuter = ease;
            }
            else {
                let { interval, ease } = this.nextState(response, 1, 250);
                this.plugin.newFlashcards.splice(0, 1);
                // don't look too closely lol
                intervalOuter = interval;
                easeOuter = ease;
            }
            // fuzz
            if (intervalOuter >= 8) {
                let fuzz = [-0.05 * intervalOuter, 0, 0.05 * intervalOuter];
                intervalOuter += fuzz[Math.floor(Math.random() * fuzz.length)];
            }
            intervalOuter = Math.round(intervalOuter);
            let due = new Date(Date.now() + intervalOuter * 24 * 3600 * 1000);
            let fileText = await this.app.vault.read(this.currentCard.note);
            let replacementRegex = new RegExp(escapeRegExp(this.currentCard.match[0]), "gm");
            if (this.currentCard.isSingleLine) {
                let sep = this.plugin.data.settings.singleLineCommentOnSameLine
                    ? " "
                    : "\n";
                fileText = fileText.replace(replacementRegex, `${this.currentCard.front}::${this.currentCard.back}${sep}<!--SR:${due.toDateString()},${intervalOuter},${easeOuter}-->`);
            }
            else {
                fileText = fileText.replace(replacementRegex, `${this.currentCard.front}\n?\n${this.currentCard.back}\n<!--SR:${due.toDateString()},${intervalOuter},${easeOuter}-->`);
            }
            await this.app.vault.modify(this.currentCard.note, fileText);
            this.nextCard();
        }
        else if (response == UserResponse.Skip) {
            if (this.currentCard.due)
                this.plugin.dueFlashcards.splice(0, 1);
            else
                this.plugin.newFlashcards.splice(0, 1);
            this.nextCard();
        }
    }
    nextState(response, interval, ease) {
        if (response != UserResponse.ReviewGood) {
            ease =
                response == UserResponse.ReviewEasy
                    ? ease + 20
                    : Math.max(130, ease - 20);
        }
        if (response == UserResponse.ReviewHard)
            interval = Math.max(1, interval * this.plugin.data.settings.lapsesIntervalChange);
        else if (response == UserResponse.ReviewGood)
            interval = (interval * ease) / 100;
        else
            interval = (1.3 * (interval * ease)) / 100;
        return { ease, interval: Math.round(interval * 10) / 10 };
    }
}
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

const SCHEDULING_INFO_REGEX = /^---\n((?:.*\n)*)sr-due: ([0-9A-Za-z ]+)\nsr-interval: (\d+)\nsr-ease: (\d+)\n((?:.*\n)*)---/;
const YAML_FRONT_MATTER_REGEX = /^---\n((?:.*\n)*)---/;
const SINGLELINE_CARD_REGEX = /^(.+)::(.+?)\n?(?:<!--SR:([0-9A-Za-z ]+),(\d+),(\d+)-->|$)/gm;
const MULTILINE_CARD_REGEX = /^((?:.+\n)+)\?\n((?:.+\n)+?)(?:<!--SR:([0-9A-Za-z ]+),(\d+),(\d+)-->|$)/gm;
const CROSS_HAIRS_ICON = `<path style=" stroke:none;fill-rule:nonzero;fill:currentColor;fill-opacity:1;" d="M 99.921875 47.941406 L 93.074219 47.941406 C 92.84375 42.03125 91.390625 36.238281 88.800781 30.921875 L 85.367188 32.582031 C 87.667969 37.355469 88.964844 42.550781 89.183594 47.84375 L 82.238281 47.84375 C 82.097656 44.617188 81.589844 41.417969 80.734375 38.304688 L 77.050781 39.335938 C 77.808594 42.089844 78.261719 44.917969 78.40625 47.769531 L 65.871094 47.769531 C 64.914062 40.507812 59.144531 34.832031 51.871094 33.996094 L 51.871094 21.386719 C 54.816406 21.507812 57.742188 21.960938 60.585938 22.738281 L 61.617188 19.058594 C 58.4375 18.191406 55.164062 17.691406 51.871094 17.570312 L 51.871094 10.550781 C 57.164062 10.769531 62.355469 12.066406 67.132812 14.363281 L 68.789062 10.929688 C 63.5 8.382812 57.738281 6.953125 51.871094 6.734375 L 51.871094 0.0390625 L 48.054688 0.0390625 L 48.054688 6.734375 C 42.179688 6.976562 36.417969 8.433594 31.132812 11.007812 L 32.792969 14.441406 C 37.566406 12.140625 42.761719 10.84375 48.054688 10.625 L 48.054688 17.570312 C 44.828125 17.714844 41.628906 18.21875 38.515625 19.078125 L 39.546875 22.757812 C 42.324219 21.988281 45.175781 21.53125 48.054688 21.386719 L 48.054688 34.03125 C 40.796875 34.949219 35.089844 40.679688 34.203125 47.941406 L 21.5 47.941406 C 21.632812 45.042969 22.089844 42.171875 22.855469 39.375 L 19.171875 38.34375 C 18.3125 41.457031 17.808594 44.65625 17.664062 47.882812 L 10.664062 47.882812 C 10.882812 42.589844 12.179688 37.394531 14.480469 32.621094 L 11.121094 30.921875 C 8.535156 36.238281 7.078125 42.03125 6.847656 47.941406 L 0 47.941406 L 0 51.753906 L 6.847656 51.753906 C 7.089844 57.636719 8.542969 63.402344 11.121094 68.695312 L 14.554688 67.035156 C 12.257812 62.261719 10.957031 57.066406 10.738281 51.773438 L 17.742188 51.773438 C 17.855469 55.042969 18.34375 58.289062 19.191406 61.445312 L 22.871094 60.414062 C 22.089844 57.5625 21.628906 54.632812 21.5 51.679688 L 34.203125 51.679688 C 35.058594 58.96875 40.773438 64.738281 48.054688 65.660156 L 48.054688 78.308594 C 45.105469 78.1875 42.183594 77.730469 39.335938 76.957031 L 38.304688 80.636719 C 41.488281 81.511719 44.757812 82.015625 48.054688 82.144531 L 48.054688 89.144531 C 42.761719 88.925781 37.566406 87.628906 32.792969 85.328125 L 31.132812 88.765625 C 36.425781 91.3125 42.183594 92.742188 48.054688 92.960938 L 48.054688 99.960938 L 51.871094 99.960938 L 51.871094 92.960938 C 57.75 92.71875 63.519531 91.265625 68.808594 88.6875 L 67.132812 85.253906 C 62.355469 87.550781 57.164062 88.851562 51.871094 89.070312 L 51.871094 82.125 C 55.09375 81.980469 58.292969 81.476562 61.40625 80.617188 L 60.378906 76.9375 C 57.574219 77.703125 54.695312 78.15625 51.792969 78.289062 L 51.792969 65.679688 C 59.121094 64.828125 64.910156 59.0625 65.796875 51.734375 L 78.367188 51.734375 C 78.25 54.734375 77.789062 57.710938 76.992188 60.605469 L 80.675781 61.636719 C 81.558594 58.40625 82.066406 55.082031 82.183594 51.734375 L 89.261719 51.734375 C 89.042969 57.03125 87.742188 62.222656 85.445312 66.996094 L 88.878906 68.65625 C 91.457031 63.367188 92.910156 57.597656 93.152344 51.71875 L 100 51.71875 Z M 62.019531 51.734375 C 61.183594 56.945312 57.085938 61.023438 51.871094 61.828125 L 51.871094 57.515625 L 48.054688 57.515625 L 48.054688 61.808594 C 42.910156 60.949219 38.886719 56.902344 38.058594 51.753906 L 42.332031 51.753906 L 42.332031 47.941406 L 38.058594 47.941406 C 38.886719 42.789062 42.910156 38.746094 48.054688 37.886719 L 48.054688 42.179688 L 51.871094 42.179688 L 51.871094 37.847656 C 57.078125 38.648438 61.179688 42.71875 62.019531 47.921875 L 57.707031 47.921875 L 57.707031 51.734375 Z M 62.019531 51.734375 "/>`;
const COLLAPSE_ICON = `<svg viewBox="0 0 100 100" width="8" height="8" class="right-triangle"><path fill="currentColor" stroke="currentColor" d="M94.9,20.8c-1.4-2.5-4.1-4.1-7.1-4.1H12.2c-3,0-5.7,1.6-7.1,4.1c-1.3,2.4-1.2,5.2,0.2,7.6L43.1,88c1.5,2.3,4,3.7,6.9,3.7 s5.4-1.4,6.9-3.7l37.8-59.6C96.1,26,96.2,23.2,94.9,20.8L94.9,20.8z"></path></svg>`;

const REVIEW_QUEUE_VIEW_TYPE = "review-queue-list-view";
class ReviewQueueListView extends obsidian.ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.activeFolders = new Set(["Today"]);
        this.registerEvent(this.app.workspace.on("file-open", (_) => this.redraw()));
        this.registerEvent(this.app.vault.on("rename", (_) => this.redraw()));
    }
    getViewType() {
        return REVIEW_QUEUE_VIEW_TYPE;
    }
    getDisplayText() {
        return "Notes Review Queue";
    }
    getIcon() {
        return "crosshairs";
    }
    onHeaderMenu(menu) {
        menu.addItem((item) => {
            item.setTitle("Close")
                .setIcon("cross")
                .onClick(() => {
                this.app.workspace.detachLeavesOfType(REVIEW_QUEUE_VIEW_TYPE);
            });
        });
    }
    redraw() {
        const openFile = this.app.workspace.getActiveFile();
        const rootEl = createDiv("nav-folder mod-root");
        const childrenEl = rootEl.createDiv("nav-folder-children");
        if (this.plugin.newNotes.length > 0) {
            let newNotesFolderEl = this.createRightPaneFolder(childrenEl, "New", !this.activeFolders.has("New"));
            for (let newFile of this.plugin.newNotes) {
                this.createRightPaneFile(newNotesFolderEl, newFile, openFile && newFile.path === openFile.path, !this.activeFolders.has("New"));
            }
        }
        if (this.plugin.scheduledNotes.length > 0) {
            let now = Date.now();
            let currUnix = -1;
            let folderEl, folderTitle;
            for (let sNote of this.plugin.scheduledNotes) {
                if (sNote.dueUnix != currUnix) {
                    let nDays = Math.ceil((sNote.dueUnix - now) / (24 * 3600 * 1000));
                    folderTitle =
                        nDays == -1
                            ? "Yesterday"
                            : nDays == 0
                                ? "Today"
                                : nDays == 1
                                    ? "Tomorrow"
                                    : new Date(sNote.dueUnix).toDateString();
                    folderEl = this.createRightPaneFolder(childrenEl, folderTitle, !this.activeFolders.has(folderTitle));
                    currUnix = sNote.dueUnix;
                }
                this.createRightPaneFile(folderEl, sNote.note, openFile && sNote.note.path === openFile.path, !this.activeFolders.has(folderTitle));
            }
        }
        const contentEl = this.containerEl.children[1];
        contentEl.empty();
        contentEl.appendChild(rootEl);
    }
    createRightPaneFolder(parentEl, folderTitle, collapsed) {
        const folderEl = parentEl.createDiv("nav-folder");
        const folderTitleEl = folderEl.createDiv("nav-folder-title");
        const childrenEl = folderEl.createDiv("nav-folder-children");
        const collapseIconEl = folderTitleEl.createDiv("nav-folder-collapse-indicator collapse-icon");
        collapseIconEl.innerHTML = COLLAPSE_ICON;
        if (collapsed)
            collapseIconEl.childNodes[0].style.transform = "rotate(-90deg)";
        folderTitleEl
            .createDiv("nav-folder-title-content")
            .setText(folderTitle);
        folderTitleEl.onClickEvent((_) => {
            for (let child of childrenEl.childNodes) {
                if (child.style.display == "block" ||
                    child.style.display == "") {
                    child.style.display = "none";
                    collapseIconEl.childNodes[0].style.transform =
                        "rotate(-90deg)";
                    this.activeFolders.delete(folderTitle);
                }
                else {
                    child.style.display = "block";
                    collapseIconEl.childNodes[0].style.transform = "";
                    this.activeFolders.add(folderTitle);
                }
            }
        });
        return childrenEl;
    }
    createRightPaneFile(folderEl, file, fileElActive, hidden) {
        const navFileEl = folderEl.createDiv("nav-file");
        if (hidden)
            navFileEl.style.display = "none";
        const navFileTitle = navFileEl.createDiv("nav-file-title");
        if (fileElActive)
            navFileTitle.addClass("is-active");
        navFileTitle.createDiv("nav-file-title-content").setText(file.basename);
        navFileTitle.addEventListener("click", (event) => {
            event.preventDefault();
            this.app.workspace.activeLeaf.openFile(file);
            return false;
        }, false);
        navFileTitle.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            const fileMenu = new obsidian.Menu(this.app);
            this.app.workspace.trigger("file-menu", fileMenu, file, "my-context-menu", null);
            fileMenu.showAtPosition({
                x: event.pageX,
                y: event.pageY,
            });
            return false;
        }, false);
    }
}

const DEFAULT_DATA = {
    settings: DEFAULT_SETTINGS,
};
var ReviewResponse;
(function (ReviewResponse) {
    ReviewResponse[ReviewResponse["Easy"] = 0] = "Easy";
    ReviewResponse[ReviewResponse["Good"] = 1] = "Good";
    ReviewResponse[ReviewResponse["Hard"] = 2] = "Hard";
})(ReviewResponse || (ReviewResponse = {}));
class SRPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.newNotes = [];
        this.scheduledNotes = [];
        this.easeByPath = {};
        this.incomingLinks = {};
        this.pageranks = {};
        this.dueNotesCount = 0;
        this.newFlashcards = [];
        this.dueFlashcards = [];
    }
    async onload() {
        await this.loadPluginData();
        obsidian.addIcon("crosshairs", CROSS_HAIRS_ICON);
        this.statusBar = this.addStatusBarItem();
        this.statusBar.classList.add("mod-clickable");
        this.statusBar.setAttribute("aria-label", "Open a note for review");
        this.statusBar.setAttribute("aria-label-position", "top");
        this.statusBar.addEventListener("click", (_) => {
            this.sync();
            this.reviewNextNote();
        });
        this.addRibbonIcon("crosshairs", "Review flashcards", async () => {
            await this.flashcards_sync();
            new FlashcardModal(this.app, this).open();
        });
        this.registerView(REVIEW_QUEUE_VIEW_TYPE, (leaf) => (this.reviewQueueView = new ReviewQueueListView(leaf, this)));
        this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
            menu.addItem((item) => {
                item.setTitle("Review: Easy")
                    .setIcon("crosshairs")
                    .onClick((evt) => {
                    if (file.extension == "md")
                        this.saveReviewResponse(file, ReviewResponse.Easy);
                });
            });
            menu.addItem((item) => {
                item.setTitle("Review: Good")
                    .setIcon("crosshairs")
                    .onClick((evt) => {
                    if (file.extension == "md")
                        this.saveReviewResponse(file, ReviewResponse.Good);
                });
            });
            menu.addItem((item) => {
                item.setTitle("Review: Hard")
                    .setIcon("crosshairs")
                    .onClick((evt) => {
                    if (file.extension == "md")
                        this.saveReviewResponse(file, ReviewResponse.Hard);
                });
            });
        }));
        this.addCommand({
            id: "note-review-open-note",
            name: "Open a note for review",
            callback: () => {
                this.sync();
                this.reviewNextNote();
            },
        });
        this.addCommand({
            id: "note-review-easy",
            name: "Review note as easy",
            callback: () => {
                const openFile = this.app.workspace.getActiveFile();
                if (openFile && openFile.extension == "md")
                    this.saveReviewResponse(openFile, ReviewResponse.Easy);
            },
        });
        this.addCommand({
            id: "note-review-good",
            name: "Review note as good",
            callback: () => {
                const openFile = this.app.workspace.getActiveFile();
                if (openFile && openFile.extension == "md")
                    this.saveReviewResponse(openFile, ReviewResponse.Good);
            },
        });
        this.addCommand({
            id: "note-review-hard",
            name: "Review note as hard",
            callback: () => {
                const openFile = this.app.workspace.getActiveFile();
                if (openFile && openFile.extension == "md")
                    this.saveReviewResponse(openFile, ReviewResponse.Hard);
            },
        });
        this.addSettingTab(new SRSettingTab(this.app, this));
        this.app.workspace.onLayoutReady(() => {
            this.initView();
            setTimeout(() => this.sync(), 2000);
        });
    }
    async sync() {
        let notes = this.app.vault.getMarkdownFiles();
        lib.reset();
        this.scheduledNotes = [];
        this.easeByPath = {};
        this.newNotes = [];
        this.incomingLinks = {};
        this.pageranks = {};
        this.dueNotesCount = 0;
        let now = Date.now();
        for (let note of notes) {
            if (this.incomingLinks[note.path] == undefined)
                this.incomingLinks[note.path] = [];
            let links = this.app.metadataCache.resolvedLinks[note.path] || {};
            for (let targetPath in links) {
                if (this.incomingLinks[targetPath] == undefined)
                    this.incomingLinks[targetPath] = [];
                // markdown files only
                if (targetPath.split(".").pop().toLowerCase() == "md") {
                    this.incomingLinks[targetPath].push({
                        sourcePath: note.path,
                        linkCount: links[targetPath],
                    });
                    lib.link(note.path, targetPath, links[targetPath]);
                }
            }
            let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
            let frontmatter = fileCachedData.frontmatter || {};
            let tags = fileCachedData.tags || [];
            let shouldIgnore = true;
            for (let tagObj of tags) {
                if (this.data.settings.tagsToReview.includes(tagObj.tag)) {
                    shouldIgnore = false;
                    break;
                }
            }
            if (frontmatter.tags) {
                if (typeof frontmatter.tags == "string") {
                    if (this.data.settings.tagsToReview.includes("#" + frontmatter.tags))
                        shouldIgnore = false;
                }
                else {
                    for (let tag of frontmatter.tags) {
                        if (this.data.settings.tagsToReview.includes("#" + tag)) {
                            shouldIgnore = false;
                            break;
                        }
                    }
                }
            }
            if (shouldIgnore)
                continue;
            // file has no scheduling information
            if (!(frontmatter.hasOwnProperty("sr-due") &&
                frontmatter.hasOwnProperty("sr-interval") &&
                frontmatter.hasOwnProperty("sr-ease"))) {
                this.newNotes.push(note);
                continue;
            }
            let dueUnix = Date.parse(frontmatter["sr-due"]);
            this.scheduledNotes.push({
                note,
                dueUnix,
            });
            this.easeByPath[note.path] = frontmatter["sr-ease"];
            if (dueUnix <= now)
                this.dueNotesCount++;
        }
        lib.rank(0.85, 0.000001, (node, rank) => {
            this.pageranks[node] = rank * 10000;
        });
        // sort new notes by importance
        this.newNotes = this.newNotes.sort((a, b) => (this.pageranks[b.path] || 0) - (this.pageranks[a.path] || 0));
        // sort scheduled notes by date & within those days, sort them by importance
        this.scheduledNotes = this.scheduledNotes.sort((a, b) => {
            let result = a.dueUnix - b.dueUnix;
            if (result != 0)
                return result;
            return ((this.pageranks[b.note.path] || 0) -
                (this.pageranks[a.note.path] || 0));
        });
        this.statusBar.setText(`Review: ${this.dueNotesCount} notes due`);
        this.reviewQueueView.redraw();
    }
    async saveReviewResponse(note, response) {
        let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
        let frontmatter = fileCachedData.frontmatter || {};
        let tags = fileCachedData.tags || [];
        let shouldIgnore = true;
        for (let tagObj of tags) {
            if (this.data.settings.tagsToReview.includes(tagObj.tag)) {
                shouldIgnore = false;
                break;
            }
        }
        if (shouldIgnore) {
            new obsidian.Notice("Please tag the note appropriately for reviewing (in settings).");
            return;
        }
        let fileText = await this.app.vault.read(note);
        let ease, interval;
        // new note
        if (!(frontmatter.hasOwnProperty("sr-due") &&
            frontmatter.hasOwnProperty("sr-interval") &&
            frontmatter.hasOwnProperty("sr-ease"))) {
            let linkTotal = 0, linkPGTotal = 0, totalLinkCount = 0;
            for (let statObj of this.incomingLinks[note.path]) {
                let ease = this.easeByPath[statObj.sourcePath];
                if (ease) {
                    linkTotal +=
                        statObj.linkCount *
                            this.pageranks[statObj.sourcePath] *
                            ease;
                    linkPGTotal +=
                        this.pageranks[statObj.sourcePath] * statObj.linkCount;
                    totalLinkCount += statObj.linkCount;
                }
            }
            let outgoingLinks = this.app.metadataCache.resolvedLinks[note.path] || {};
            for (let linkedFilePath in outgoingLinks) {
                let ease = this.easeByPath[linkedFilePath];
                if (ease) {
                    linkTotal +=
                        outgoingLinks[linkedFilePath] *
                            this.pageranks[linkedFilePath] *
                            ease;
                    linkPGTotal +=
                        this.pageranks[linkedFilePath] *
                            outgoingLinks[linkedFilePath];
                    totalLinkCount += outgoingLinks[linkedFilePath];
                }
            }
            let linkContribution = this.data.settings.maxLinkFactor *
                Math.min(1.0, Math.log(totalLinkCount + 0.5) / Math.log(64));
            ease = Math.round((1.0 - linkContribution) * this.data.settings.baseEase +
                (totalLinkCount > 0
                    ? (linkContribution * linkTotal) / linkPGTotal
                    : linkContribution * this.data.settings.baseEase));
            interval = 1;
        }
        else {
            interval = frontmatter["sr-interval"];
            ease = frontmatter["sr-ease"];
        }
        if (response != ReviewResponse.Good) {
            ease =
                response == ReviewResponse.Easy
                    ? ease + 20
                    : Math.max(130, ease - 20);
        }
        if (response == ReviewResponse.Hard)
            interval = Math.max(1, interval * this.data.settings.lapsesIntervalChange);
        else if (response == ReviewResponse.Good)
            interval = (interval * ease) / 100;
        else
            interval = (1.3 * (interval * ease)) / 100;
        // fuzz
        if (interval >= 8) {
            let fuzz = [-0.05 * interval, 0, 0.05 * interval];
            interval += fuzz[Math.floor(Math.random() * fuzz.length)];
        }
        interval = Math.round(interval);
        let due = new Date(Date.now() + interval * 24 * 3600 * 1000);
        // check if scheduling info exists
        if (SCHEDULING_INFO_REGEX.test(fileText)) {
            let schedulingInfo = SCHEDULING_INFO_REGEX.exec(fileText);
            fileText = fileText.replace(SCHEDULING_INFO_REGEX, `---\n${schedulingInfo[1]}sr-due: ${due.toDateString()}\nsr-interval: ${interval}\nsr-ease: ${ease}\n${schedulingInfo[5]}---`);
            // new note with existing YAML front matter
        }
        else if (YAML_FRONT_MATTER_REGEX.test(fileText)) {
            let existingYaml = YAML_FRONT_MATTER_REGEX.exec(fileText);
            fileText = fileText.replace(YAML_FRONT_MATTER_REGEX, `---\n${existingYaml[1]}sr-due: ${due.toDateString()}\nsr-interval: ${interval}\nsr-ease: ${ease}\n---`);
        }
        else {
            fileText = `---\nsr-due: ${due.toDateString()}\nsr-interval: ${interval}\nsr-ease: ${ease}\n---\n\n${fileText}`;
        }
        this.app.vault.modify(note, fileText);
        new obsidian.Notice("Response received.");
        setTimeout(() => {
            this.sync();
            if (this.data.settings.autoNextNote)
                this.reviewNextNote();
        }, 500);
    }
    async reviewNextNote() {
        if (this.dueNotesCount > 0) {
            let index = this.data.settings.openRandomNote
                ? Math.floor(Math.random() * this.dueNotesCount)
                : 0;
            this.app.workspace.activeLeaf.openFile(this.scheduledNotes[index].note);
            return;
        }
        if (this.newNotes.length > 0) {
            let index = this.data.settings.openRandomNote
                ? Math.floor(Math.random() * this.newNotes.length)
                : 0;
            this.app.workspace.activeLeaf.openFile(this.newNotes[index]);
            return;
        }
        new obsidian.Notice("You're done for the day :D.");
    }
    async flashcards_sync() {
        let notes = this.app.vault.getMarkdownFiles();
        this.newFlashcards = [];
        this.dueFlashcards = [];
        for (let note of notes) {
            let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
            let frontmatter = fileCachedData.frontmatter || {};
            let tags = fileCachedData.tags || [];
            for (let tagObj of tags) {
                if (tagObj.tag == this.data.settings.flashcardsTag) {
                    await this.findFlashcards(note);
                    break;
                }
            }
            if (frontmatter.tags) {
                if (typeof frontmatter.tags == "string") {
                    if (this.data.settings.flashcardsTag ==
                        "#" + frontmatter.tags)
                        await this.findFlashcards(note);
                }
                else {
                    for (let tag of frontmatter.tags) {
                        if (this.data.settings.flashcardsTag == "#" + tag) {
                            await this.findFlashcards(note);
                            break;
                        }
                    }
                }
            }
        }
    }
    async findFlashcards(note) {
        let fileText = await this.app.vault.read(note);
        let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
        let headings = fileCachedData.headings || [];
        let now = Date.now();
        for (let regex of [SINGLELINE_CARD_REGEX, MULTILINE_CARD_REGEX]) {
            let isSingleLine = regex == SINGLELINE_CARD_REGEX;
            for (let match of fileText.matchAll(regex)) {
                match[0] = match[0].trim();
                match[1] = match[1].trim();
                match[2] = match[2].trim();
                let cardObj;
                // flashcard already scheduled
                if (match[3]) {
                    if (Date.parse(match[3]) <= now) {
                        cardObj = {
                            front: match[1],
                            back: match[2],
                            note,
                            due: match[3],
                            interval: parseInt(match[4]),
                            ease: parseInt(match[5]),
                            match,
                            isSingleLine,
                        };
                        this.dueFlashcards.push(cardObj);
                    }
                    else
                        continue;
                }
                else {
                    cardObj = {
                        front: match[1],
                        back: match[2],
                        match,
                        note,
                        isSingleLine,
                    };
                    this.newFlashcards.push(cardObj);
                }
                let cardOffset = match.index;
                let stack = [];
                for (let heading of headings) {
                    if (heading.position.start.offset > cardOffset)
                        break;
                    while (stack.length > 0 &&
                        stack[stack.length - 1].level >= heading.level)
                        stack.pop();
                    stack.push(heading);
                }
                cardObj.context = "";
                for (let headingObj of stack)
                    cardObj.context += headingObj.heading + " > ";
                cardObj.context = cardObj.context.slice(0, -3);
            }
        }
    }
    async loadPluginData() {
        this.data = Object.assign({}, DEFAULT_DATA, await this.loadData());
    }
    async savePluginData() {
        await this.saveData(this.data);
    }
    initView() {
        if (this.app.workspace.getLeavesOfType(REVIEW_QUEUE_VIEW_TYPE).length) {
            return;
        }
        this.app.workspace.getRightLeaf(false).setViewState({
            type: REVIEW_QUEUE_VIEW_TYPE,
            active: true,
        });
    }
}

module.exports = SRPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3BhZ2VyYW5rLmpzL2xpYi9pbmRleC5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9mbGFzaGNhcmQtbW9kYWwudHMiLCJzcmMvY29uc3RhbnRzLnRzIiwic3JjL3NpZGViYXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZvck93bihvYmplY3QsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCh0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JykgJiYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKG9iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGtleSwgb2JqZWN0W2tleV0pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHtcbiAgICAgICAgY291bnQ6IDAsXG4gICAgICAgIGVkZ2VzOiB7fSxcbiAgICAgICAgbm9kZXM6IHt9XG4gICAgfTtcblxuICAgIHNlbGYubGluayA9IGZ1bmN0aW9uIChzb3VyY2UsIHRhcmdldCwgd2VpZ2h0KSB7XG4gICAgICAgIGlmICgoaXNGaW5pdGUod2VpZ2h0KSAhPT0gdHJ1ZSkgfHwgKHdlaWdodCA9PT0gbnVsbCkpIHtcbiAgICAgICAgICAgIHdlaWdodCA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdlaWdodCA9IHBhcnNlRmxvYXQod2VpZ2h0KTtcblxuICAgICAgICBpZiAoc2VsZi5ub2Rlcy5oYXNPd25Qcm9wZXJ0eShzb3VyY2UpICE9PSB0cnVlKSB7XG4gICAgICAgICAgICBzZWxmLmNvdW50Kys7XG4gICAgICAgICAgICBzZWxmLm5vZGVzW3NvdXJjZV0gPSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0OiAwLFxuICAgICAgICAgICAgICAgIG91dGJvdW5kOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kICs9IHdlaWdodDtcblxuICAgICAgICBpZiAoc2VsZi5ub2Rlcy5oYXNPd25Qcm9wZXJ0eSh0YXJnZXQpICE9PSB0cnVlKSB7XG4gICAgICAgICAgICBzZWxmLmNvdW50Kys7XG4gICAgICAgICAgICBzZWxmLm5vZGVzW3RhcmdldF0gPSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0OiAwLFxuICAgICAgICAgICAgICAgIG91dGJvdW5kOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNlbGYuZWRnZXMuaGFzT3duUHJvcGVydHkoc291cmNlKSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgc2VsZi5lZGdlc1tzb3VyY2VdID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsZi5lZGdlc1tzb3VyY2VdLmhhc093blByb3BlcnR5KHRhcmdldCkgIT09IHRydWUpIHtcbiAgICAgICAgICAgIHNlbGYuZWRnZXNbc291cmNlXVt0YXJnZXRdID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuZWRnZXNbc291cmNlXVt0YXJnZXRdICs9IHdlaWdodDtcbiAgICB9O1xuXG4gICAgc2VsZi5yYW5rID0gZnVuY3Rpb24gKGFscGhhLCBlcHNpbG9uLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVsdGEgPSAxLFxuICAgICAgICAgICAgaW52ZXJzZSA9IDEgLyBzZWxmLmNvdW50O1xuXG4gICAgICAgIGZvck93bihzZWxmLmVkZ2VzLCBmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kID4gMCkge1xuICAgICAgICAgICAgICAgIGZvck93bihzZWxmLmVkZ2VzW3NvdXJjZV0sIGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lZGdlc1tzb3VyY2VdW3RhcmdldF0gLz0gc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgc2VsZi5ub2Rlc1trZXldLndlaWdodCA9IGludmVyc2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdoaWxlIChkZWx0YSA+IGVwc2lsb24pIHtcbiAgICAgICAgICAgIHZhciBsZWFrID0gMCxcbiAgICAgICAgICAgICAgICBub2RlcyA9IHt9O1xuXG4gICAgICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBub2Rlc1trZXldID0gdmFsdWUud2VpZ2h0O1xuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlLm91dGJvdW5kID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxlYWsgKz0gdmFsdWUud2VpZ2h0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYubm9kZXNba2V5XS53ZWlnaHQgPSAwO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxlYWsgKj0gYWxwaGE7XG5cbiAgICAgICAgICAgIGZvck93bihzZWxmLm5vZGVzLCBmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgICAgICAgICAgZm9yT3duKHNlbGYuZWRnZXNbc291cmNlXSwgZnVuY3Rpb24gKHRhcmdldCwgd2VpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYubm9kZXNbdGFyZ2V0XS53ZWlnaHQgKz0gYWxwaGEgKiBub2Rlc1tzb3VyY2VdICogd2VpZ2h0O1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5ub2Rlc1tzb3VyY2VdLndlaWdodCArPSAoMSAtIGFscGhhKSAqIGludmVyc2UgKyBsZWFrICogaW52ZXJzZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWx0YSA9IDA7XG5cbiAgICAgICAgICAgIGZvck93bihzZWxmLm5vZGVzLCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGRlbHRhICs9IE1hdGguYWJzKHZhbHVlLndlaWdodCAtIG5vZGVzW2tleV0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGtleSwgc2VsZi5ub2Rlc1trZXldLndlaWdodCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNvdW50ID0gMDtcbiAgICAgICAgc2VsZi5lZGdlcyA9IHt9O1xuICAgICAgICBzZWxmLm5vZGVzID0ge307XG4gICAgfTtcblxuICAgIHJldHVybiBzZWxmO1xufSkoKTtcbiIsImltcG9ydCB7IE5vdGljZSwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBTUlBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU1JTZXR0aW5ncyB7XG4gICAgYmFzZUVhc2U6IG51bWJlcjtcbiAgICBtYXhMaW5rRmFjdG9yOiBudW1iZXI7XG4gICAgb3BlblJhbmRvbU5vdGU6IGJvb2xlYW47XG4gICAgbGFwc2VzSW50ZXJ2YWxDaGFuZ2U6IG51bWJlcjtcbiAgICBhdXRvTmV4dE5vdGU6IGJvb2xlYW47XG4gICAgdGFnc1RvUmV2aWV3OiBzdHJpbmdbXTtcbiAgICBmbGFzaGNhcmRzVGFnOiBzdHJpbmc7XG4gICAgc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lOiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9TRVRUSU5HUzogU1JTZXR0aW5ncyA9IHtcbiAgICBiYXNlRWFzZTogMjUwLFxuICAgIG1heExpbmtGYWN0b3I6IDEuMCxcbiAgICBvcGVuUmFuZG9tTm90ZTogZmFsc2UsXG4gICAgbGFwc2VzSW50ZXJ2YWxDaGFuZ2U6IDAuNSxcbiAgICBhdXRvTmV4dE5vdGU6IGZhbHNlLFxuICAgIHRhZ3NUb1JldmlldzogW1wiI3Jldmlld1wiXSxcbiAgICBmbGFzaGNhcmRzVGFnOiBcIiNmbGFzaGNhcmRzXCIsXG4gICAgc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lOiBmYWxzZSxcbn07XG5cbmV4cG9ydCBjbGFzcyBTUlNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgICBwcml2YXRlIHBsdWdpbjogU1JQbHVnaW47XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBTUlBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIH1cblxuICAgIGRpc3BsYXkoKSB7XG4gICAgICAgIGxldCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkZsYXNoY2FyZHMgdGFnXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIkVudGVyIG9uZSB0YWcgaS5lLiAjZmxhc2hjYXJkcy5cIilcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKGAke3RoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkc1RhZ31gKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmZsYXNoY2FyZHNUYWcgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJUYWdzIHRvIHJldmlld1wiKVxuICAgICAgICAgICAgLnNldERlc2MoXCJFbnRlciB0YWdzIHNlcGFyYXRlZCBieSBzcGFjZXMgaS5lLiAjcmV2aWV3ICN0YWcyICN0YWczLlwiKVxuICAgICAgICAgICAgLmFkZFRleHRBcmVhKCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy50YWdzVG9SZXZpZXcuam9pbihcIiBcIil9YFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MudGFnc1RvUmV2aWV3ID0gdmFsdWUuc3BsaXQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKFwiU2F2ZSBjb21tZW50IGZvciBzaW5nbGUtbGluZSBub3RlcyBvbiB0aGUgc2FtZSBsaW5lP1wiKVxuICAgICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICAgICAgXCJUdXJuaW5nIHRoaXMgb24gd2lsbCBtYWtlIHRoZSBIVE1MIGNvbW1lbnRzIG5vdCBicmVhayBsaXN0IGZvcm1hdHRpbmdcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLnNpbmdsZUxpbmVDb21tZW50T25TYW1lTGluZVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3Muc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKFwiT3BlbiBhIHJhbmRvbSBub3RlIGZvciByZXZpZXdcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIFwiV2hlbiB5b3UgdHVybiB0aGlzIG9mZiwgbm90ZXMgYXJlIG9yZGVyZWQgYnkgaW1wb3J0YW5jZSAoUGFnZVJhbmspXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgICAgICB0b2dnbGVcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3Mub3BlblJhbmRvbU5vdGUpXG4gICAgICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3Mub3BlblJhbmRvbU5vdGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJPcGVuIG5leHQgbm90ZSBhdXRvbWF0aWNhbGx5IGFmdGVyIGEgcmV2aWV3XCIpXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmF1dG9OZXh0Tm90ZSlcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5hdXRvTmV4dE5vdGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJCYXNlIGVhc2VcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFwibWluaW11bSA9IDEzMCwgcHJlZmVycmFibHkgYXBwcm94aW1hdGVseSAyNTBcIilcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKGAke3RoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2V9YClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG51bVZhbHVlOiBudW1iZXIgPSBOdW1iZXIucGFyc2VJbnQodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihudW1WYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobnVtVmFsdWUgPCAxMzApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGJhc2UgZWFzZSBtdXN0IGJlIGF0IGxlYXN0IDEzMC5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5iYXNlRWFzZX1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJhc2VFYXNlID0gbnVtVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpbkRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgbnVtYmVyLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkludGVydmFsIGNoYW5nZSB3aGVuIHlvdSByZXZpZXcgYSBub3RlL2NvbmNlcHQgYXMgaGFyZFwiKVxuICAgICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICAgICAgXCJuZXdJbnRlcnZhbCA9IG9sZEludGVydmFsICogaW50ZXJ2YWxDaGFuZ2UgLyAxMDAsIDAlIDwgaW50ZXJ2YWxDaGFuZ2UgPCAxMDAlXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5sYXBzZXNJbnRlcnZhbENoYW5nZSAqIDEwMFxuICAgICAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVmFsdWU6IG51bWJlciA9IE51bWJlci5wYXJzZUludCh2YWx1ZSkgLyAxMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChudW1WYWx1ZSA8IDAuMDEgfHwgbnVtVmFsdWUgPiAwLjk5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlRoZSBsb2FkIGJhbGFuY2luZyB0aHJlc2hvbGQgbXVzdCBiZSBpbiB0aGUgcmFuZ2UgMCUgPCBpbnRlcnZhbENoYW5nZSA8IDEwMCUuXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3NcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmxhcHNlc0ludGVydmFsQ2hhbmdlICogMTAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5sYXBzZXNJbnRlcnZhbENoYW5nZSA9IG51bVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIG51bWJlci5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJNYXhpbXVtIGxpbmsgY29udHJpYnV0aW9uXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIk1heC4gY29udHJpYnV0aW9uIG9mIHRoZSB3ZWlnaHRlZCBlYXNlIG9mIGxpbmtlZCBub3RlcyB0byB0aGUgaW5pdGlhbCBlYXNlICgwJSA8PSBtYXhMaW5rRmFjdG9yIDw9IDEwMCUpXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5tYXhMaW5rRmFjdG9yICogMTAwfWBcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVmFsdWU6IG51bWJlciA9IE51bWJlci5wYXJzZUludCh2YWx1ZSkgLyAxMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChudW1WYWx1ZSA8IDAgfHwgbnVtVmFsdWUgPiAxLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGxpbmsgZmFjdG9yIG11c3QgYmUgaW4gdGhlIHJhbmdlIDAlIDw9IG1heExpbmtGYWN0b3IgPD0gMTAwJS5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWF4TGlua0ZhY3RvciAqIDEwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MubWF4TGlua0ZhY3RvciA9IG51bVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIG51bWJlci5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGxldCBoZWxwRWwgPSBjb250YWluZXJFbC5jcmVhdGVEaXYoXCJzci1oZWxwLWRpdlwiKTtcbiAgICAgICAgaGVscEVsLmlubmVySFRNTCA9XG4gICAgICAgICAgICAnPGEgaHJlZj1cImh0dHBzOi8vZ2l0aHViLmNvbS9zdDN2M25tdy9vYnNpZGlhbi1zcGFjZWQtcmVwZXRpdGlvbi9ibG9iL21hc3Rlci9SRUFETUUubWRcIj5Gb3IgbW9yZSBpbmZvcm1hdGlvbiwgY2hlY2sgdGhlIFJFQURNRS48L2E+JztcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBNb2RhbCwgQXBwLCBNYXJrZG93blJlbmRlcmVyLCBOb3RpY2UgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIFNSUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IENhcmQgfSBmcm9tIFwiLi9tYWluXCI7XG5cbmVudW0gVXNlclJlc3BvbnNlIHtcbiAgICBTaG93QW5zd2VyLFxuICAgIFJldmlld0hhcmQsXG4gICAgUmV2aWV3R29vZCxcbiAgICBSZXZpZXdFYXN5LFxuICAgIFNraXAsXG59XG5cbmVudW0gTW9kZSB7XG4gICAgRnJvbnQsXG4gICAgQmFjayxcbiAgICBDbG9zZWQsXG59XG5cbmV4cG9ydCBjbGFzcyBGbGFzaGNhcmRNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgICBwcml2YXRlIHBsdWdpbjogU1JQbHVnaW47XG4gICAgcHJpdmF0ZSBhbnN3ZXJCdG46IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgZmxhc2hjYXJkVmlldzogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBoYXJkQnRuOiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIGdvb2RCdG46IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgZWFzeUJ0bjogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSByZXNwb25zZURpdjogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBmaWxlTGlua1ZpZXc6IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgY29udGV4dFZpZXc6IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgY3VycmVudENhcmQ6IENhcmQ7XG4gICAgcHJpdmF0ZSBtb2RlOiBNb2RlO1xuXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogU1JQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblxuICAgICAgICB0aGlzLnRpdGxlRWwuc2V0VGV4dChcIlF1ZXVlXCIpO1xuICAgICAgICB0aGlzLm1vZGFsRWwuc3R5bGUuaGVpZ2h0ID0gXCI4MCVcIjtcbiAgICAgICAgdGhpcy5tb2RhbEVsLnN0eWxlLndpZHRoID0gXCI0MCVcIjtcblxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuc3R5bGUuaGVpZ2h0ID0gXCI5MiVcIjtcblxuICAgICAgICB0aGlzLmZpbGVMaW5rVmlldyA9IGNyZWF0ZURpdihcInNyLWxpbmtcIik7XG4gICAgICAgIHRoaXMuZmlsZUxpbmtWaWV3LnNldFRleHQoXCJPcGVuIGZpbGVcIik7XG4gICAgICAgIHRoaXMuZmlsZUxpbmtWaWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoXykgPT4ge1xuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLm9wZW5GaWxlKFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQubm90ZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMuZmlsZUxpbmtWaWV3KTtcblxuICAgICAgICB0aGlzLmNvbnRleHRWaWV3ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgdGhpcy5jb250ZXh0Vmlldy5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInNyLWNvbnRleHRcIik7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMuY29udGV4dFZpZXcpO1xuXG4gICAgICAgIHRoaXMuZmxhc2hjYXJkVmlldyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMuZmxhc2hjYXJkVmlldyk7XG5cbiAgICAgICAgdGhpcy5yZXNwb25zZURpdiA9IGNyZWF0ZURpdihcInNyLXJlc3BvbnNlXCIpO1xuXG4gICAgICAgIHRoaXMuaGFyZEJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgICAgIHRoaXMuaGFyZEJ0bi5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInNyLWhhcmQtYnRuXCIpO1xuICAgICAgICB0aGlzLmhhcmRCdG4uc2V0VGV4dChcIkhhcmRcIik7XG4gICAgICAgIHRoaXMuaGFyZEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKF8pID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc1Jlc3BvbnNlKFVzZXJSZXNwb25zZS5SZXZpZXdIYXJkKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVzcG9uc2VEaXYuYXBwZW5kQ2hpbGQodGhpcy5oYXJkQnRuKTtcblxuICAgICAgICB0aGlzLmdvb2RCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICAgICAgICB0aGlzLmdvb2RCdG4uc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJzci1nb29kLWJ0blwiKTtcbiAgICAgICAgdGhpcy5nb29kQnRuLnNldFRleHQoXCJHb29kXCIpO1xuICAgICAgICB0aGlzLmdvb2RCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXNwb25zZShVc2VyUmVzcG9uc2UuUmV2aWV3R29vZCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGl2LmFwcGVuZENoaWxkKHRoaXMuZ29vZEJ0bik7XG5cbiAgICAgICAgdGhpcy5lYXN5QnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgdGhpcy5lYXN5QnRuLnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItZWFzeS1idG5cIik7XG4gICAgICAgIHRoaXMuZWFzeUJ0bi5zZXRUZXh0KFwiRWFzeVwiKTtcbiAgICAgICAgdGhpcy5lYXN5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoXykgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlJldmlld0Vhc3kpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXNwb25zZURpdi5hcHBlbmRDaGlsZCh0aGlzLmVhc3lCdG4pO1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGl2LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCh0aGlzLnJlc3BvbnNlRGl2KTtcblxuICAgICAgICB0aGlzLmFuc3dlckJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHRoaXMuYW5zd2VyQnRuLnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3Itc2hvdy1hbnN3ZXJcIik7XG4gICAgICAgIHRoaXMuYW5zd2VyQnRuLnNldFRleHQoXCJTaG93IEFuc3dlclwiKTtcbiAgICAgICAgdGhpcy5hbnN3ZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXNwb25zZShVc2VyUmVzcG9uc2UuU2hvd0Fuc3dlcik7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCh0aGlzLmFuc3dlckJ0bik7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5vbmtleXByZXNzID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLm1vZGUgIT0gTW9kZS5DbG9zZWQgJiYgZS5jb2RlID09IFwiS2V5U1wiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlNraXApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGUgPT0gTW9kZS5Gcm9udCAmJlxuICAgICAgICAgICAgICAgIChlLmNvZGUgPT0gXCJTcGFjZVwiIHx8IGUuY29kZSA9PSBcIkVudGVyXCIpXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlNob3dBbnN3ZXIpO1xuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5tb2RlID09IE1vZGUuQmFjaykge1xuICAgICAgICAgICAgICAgIGlmIChlLmNvZGUgPT0gXCJOdW1wYWQxXCIgfHwgZS5jb2RlID09IFwiRGlnaXQxXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1Jlc3BvbnNlKFVzZXJSZXNwb25zZS5SZXZpZXdIYXJkKTtcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChlLmNvZGUgPT0gXCJOdW1wYWQyXCIgfHwgZS5jb2RlID09IFwiRGlnaXQyXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1Jlc3BvbnNlKFVzZXJSZXNwb25zZS5SZXZpZXdHb29kKTtcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChlLmNvZGUgPT0gXCJOdW1wYWQzXCIgfHwgZS5jb2RlID09IFwiRGlnaXQzXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1Jlc3BvbnNlKFVzZXJSZXNwb25zZS5SZXZpZXdFYXN5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBvbk9wZW4oKSB7XG4gICAgICAgIHRoaXMubmV4dENhcmQoKTtcbiAgICB9XG5cbiAgICBvbkNsb3NlKCkge1xuICAgICAgICB0aGlzLm1vZGUgPSBNb2RlLkNsb3NlZDtcbiAgICB9XG5cbiAgICBuZXh0Q2FyZCgpIHtcbiAgICAgICAgdGhpcy5yZXNwb25zZURpdi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGxldCBjb3VudCA9XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzLmxlbmd0aCArIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMubGVuZ3RoO1xuICAgICAgICB0aGlzLnRpdGxlRWwuc2V0VGV4dChgUXVldWUgLSAke2NvdW50fWApO1xuXG4gICAgICAgIGlmIChjb3VudCA9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmZpbGVMaW5rVmlldy5pbm5lckhUTUwgPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0Vmlldy5pbm5lckhUTUwgPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LmlubmVySFRNTCA9XG4gICAgICAgICAgICAgICAgXCI8aDMgc3R5bGU9J3RleHQtYWxpZ246IGNlbnRlcjsgbWFyZ2luLXRvcDogNTAlOyc+WW91J3JlIGRvbmUgZm9yIHRoZSBkYXkgOkQuPC9oMz5cIjtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYW5zd2VyQnRuLnN0eWxlLmRpc3BsYXkgPSBcImluaXRpYWxcIjtcbiAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgIHRoaXMubW9kZSA9IE1vZGUuRnJvbnQ7XG5cbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZCA9IHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHNbMF07XG4gICAgICAgICAgICBNYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuZnJvbnQsXG4gICAgICAgICAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQubm90ZS5wYXRoLFxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBsZXQgaGFyZEludGVydmFsID0gdGhpcy5uZXh0U3RhdGUoXG4gICAgICAgICAgICAgICAgVXNlclJlc3BvbnNlLlJldmlld0hhcmQsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5pbnRlcnZhbCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmVhc2VcbiAgICAgICAgICAgICkuaW50ZXJ2YWw7XG4gICAgICAgICAgICBsZXQgZ29vZEludGVydmFsID0gdGhpcy5uZXh0U3RhdGUoXG4gICAgICAgICAgICAgICAgVXNlclJlc3BvbnNlLlJldmlld0dvb2QsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5pbnRlcnZhbCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmVhc2VcbiAgICAgICAgICAgICkuaW50ZXJ2YWw7XG4gICAgICAgICAgICBsZXQgZWFzeUludGVydmFsID0gdGhpcy5uZXh0U3RhdGUoXG4gICAgICAgICAgICAgICAgVXNlclJlc3BvbnNlLlJldmlld0Vhc3ksXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5pbnRlcnZhbCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmVhc2VcbiAgICAgICAgICAgICkuaW50ZXJ2YWw7XG5cbiAgICAgICAgICAgIHRoaXMuaGFyZEJ0bi5zZXRUZXh0KGBIYXJkIC0gJHtoYXJkSW50ZXJ2YWx9IGRheShzKWApO1xuICAgICAgICAgICAgdGhpcy5nb29kQnRuLnNldFRleHQoYEdvb2QgLSAke2dvb2RJbnRlcnZhbH0gZGF5KHMpYCk7XG4gICAgICAgICAgICB0aGlzLmVhc3lCdG4uc2V0VGV4dChgRWFzeSAtICR7ZWFzeUludGVydmFsfSBkYXkocylgKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQgPSB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzWzBdO1xuICAgICAgICAgICAgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmZyb250LFxuICAgICAgICAgICAgICAgIHRoaXMuZmxhc2hjYXJkVmlldyxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLm5vdGUucGF0aCxcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpblxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRoaXMuaGFyZEJ0bi5zZXRUZXh0KFwiSGFyZCAtIDEuMCBkYXkocylcIik7XG4gICAgICAgICAgICB0aGlzLmdvb2RCdG4uc2V0VGV4dChcIkdvb2QgLSAyLjUgZGF5KHMpXCIpO1xuICAgICAgICAgICAgdGhpcy5lYXN5QnRuLnNldFRleHQoXCJFYXN5IC0gMy41IGRheShzKVwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29udGV4dFZpZXcuc2V0VGV4dCh0aGlzLmN1cnJlbnRDYXJkLmNvbnRleHQpO1xuICAgIH1cblxuICAgIGFzeW5jIHByb2Nlc3NSZXNwb25zZShyZXNwb25zZTogVXNlclJlc3BvbnNlKSB7XG4gICAgICAgIGlmIChyZXNwb25zZSA9PSBVc2VyUmVzcG9uc2UuU2hvd0Fuc3dlcikge1xuICAgICAgICAgICAgdGhpcy5tb2RlID0gTW9kZS5CYWNrO1xuXG4gICAgICAgICAgICB0aGlzLmFuc3dlckJ0bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICB0aGlzLnJlc3BvbnNlRGl2LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIjtcblxuICAgICAgICAgICAgbGV0IGhyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhyXCIpO1xuICAgICAgICAgICAgaHIuc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJzci1oci1jYXJkLWRpdmlkZVwiKTtcbiAgICAgICAgICAgIHRoaXMuZmxhc2hjYXJkVmlldy5hcHBlbmRDaGlsZChocik7XG4gICAgICAgICAgICBNYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuYmFjayxcbiAgICAgICAgICAgICAgICB0aGlzLmZsYXNoY2FyZFZpZXcsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5ub3RlLnBhdGgsXG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW5cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICByZXNwb25zZSA9PSBVc2VyUmVzcG9uc2UuUmV2aWV3SGFyZCB8fFxuICAgICAgICAgICAgcmVzcG9uc2UgPT0gVXNlclJlc3BvbnNlLlJldmlld0dvb2QgfHxcbiAgICAgICAgICAgIHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5SZXZpZXdFYXN5XG4gICAgICAgICkge1xuICAgICAgICAgICAgbGV0IGludGVydmFsT3V0ZXIsIGVhc2VPdXRlcjtcbiAgICAgICAgICAgIC8vIHNjaGVkdWxlZCBjYXJkXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5kdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzLnNwbGljZSgwLCAxKTtcbiAgICAgICAgICAgICAgICBsZXQgeyBpbnRlcnZhbCwgZWFzZSB9ID0gdGhpcy5uZXh0U3RhdGUoXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmludGVydmFsLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmVhc2VcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIC8vIGRvbid0IGxvb2sgdG9vIGNsb3NlbHkgbG9sXG4gICAgICAgICAgICAgICAgaW50ZXJ2YWxPdXRlciA9IGludGVydmFsO1xuICAgICAgICAgICAgICAgIGVhc2VPdXRlciA9IGVhc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCB7IGludGVydmFsLCBlYXNlIH0gPSB0aGlzLm5leHRTdGF0ZShyZXNwb25zZSwgMSwgMjUwKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzLnNwbGljZSgwLCAxKTtcbiAgICAgICAgICAgICAgICAvLyBkb24ndCBsb29rIHRvbyBjbG9zZWx5IGxvbFxuICAgICAgICAgICAgICAgIGludGVydmFsT3V0ZXIgPSBpbnRlcnZhbDtcbiAgICAgICAgICAgICAgICBlYXNlT3V0ZXIgPSBlYXNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBmdXp6XG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWxPdXRlciA+PSA4KSB7XG4gICAgICAgICAgICAgICAgbGV0IGZ1enogPSBbLTAuMDUgKiBpbnRlcnZhbE91dGVyLCAwLCAwLjA1ICogaW50ZXJ2YWxPdXRlcl07XG4gICAgICAgICAgICAgICAgaW50ZXJ2YWxPdXRlciArPSBmdXp6W01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGZ1enoubGVuZ3RoKV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbnRlcnZhbE91dGVyID0gTWF0aC5yb3VuZChpbnRlcnZhbE91dGVyKTtcblxuICAgICAgICAgICAgbGV0IGR1ZSA9IG5ldyBEYXRlKERhdGUubm93KCkgKyBpbnRlcnZhbE91dGVyICogMjQgKiAzNjAwICogMTAwMCk7XG5cbiAgICAgICAgICAgIGxldCBmaWxlVGV4dCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGhpcy5jdXJyZW50Q2FyZC5ub3RlKTtcbiAgICAgICAgICAgIGxldCByZXBsYWNlbWVudFJlZ2V4ID0gbmV3IFJlZ0V4cChcbiAgICAgICAgICAgICAgICBlc2NhcGVSZWdFeHAodGhpcy5jdXJyZW50Q2FyZC5tYXRjaFswXSksXG4gICAgICAgICAgICAgICAgXCJnbVwiXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQuaXNTaW5nbGVMaW5lKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNlcCA9IHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3Muc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lXG4gICAgICAgICAgICAgICAgICAgID8gXCIgXCJcbiAgICAgICAgICAgICAgICAgICAgOiBcIlxcblwiO1xuXG4gICAgICAgICAgICAgICAgZmlsZVRleHQgPSBmaWxlVGV4dC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICByZXBsYWNlbWVudFJlZ2V4LFxuICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLmN1cnJlbnRDYXJkLmZyb250fTo6JHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuYmFja1xuICAgICAgICAgICAgICAgICAgICB9JHtzZXB9PCEtLVNSOiR7ZHVlLnRvRGF0ZVN0cmluZygpfSwke2ludGVydmFsT3V0ZXJ9LCR7ZWFzZU91dGVyfS0tPmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaWxlVGV4dCA9IGZpbGVUZXh0LnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50UmVnZXgsXG4gICAgICAgICAgICAgICAgICAgIGAke3RoaXMuY3VycmVudENhcmQuZnJvbnR9XFxuP1xcbiR7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmJhY2tcbiAgICAgICAgICAgICAgICAgICAgfVxcbjwhLS1TUjoke2R1ZS50b0RhdGVTdHJpbmcoKX0sJHtpbnRlcnZhbE91dGVyfSwke2Vhc2VPdXRlcn0tLT5gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHRoaXMuY3VycmVudENhcmQubm90ZSwgZmlsZVRleHQpO1xuICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5Ta2lwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5kdWUpIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMuc3BsaWNlKDAsIDEpO1xuICAgICAgICAgICAgZWxzZSB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzLnNwbGljZSgwLCAxKTtcbiAgICAgICAgICAgIHRoaXMubmV4dENhcmQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5leHRTdGF0ZShyZXNwb25zZTogVXNlclJlc3BvbnNlLCBpbnRlcnZhbDogbnVtYmVyLCBlYXNlOiBudW1iZXIpIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlICE9IFVzZXJSZXNwb25zZS5SZXZpZXdHb29kKSB7XG4gICAgICAgICAgICBlYXNlID1cbiAgICAgICAgICAgICAgICByZXNwb25zZSA9PSBVc2VyUmVzcG9uc2UuUmV2aWV3RWFzeVxuICAgICAgICAgICAgICAgICAgICA/IGVhc2UgKyAyMFxuICAgICAgICAgICAgICAgICAgICA6IE1hdGgubWF4KDEzMCwgZWFzZSAtIDIwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXNwb25zZSA9PSBVc2VyUmVzcG9uc2UuUmV2aWV3SGFyZClcbiAgICAgICAgICAgIGludGVydmFsID0gTWF0aC5tYXgoXG4gICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICAgICBpbnRlcnZhbCAqIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MubGFwc2VzSW50ZXJ2YWxDaGFuZ2VcbiAgICAgICAgICAgICk7XG4gICAgICAgIGVsc2UgaWYgKHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5SZXZpZXdHb29kKVxuICAgICAgICAgICAgaW50ZXJ2YWwgPSAoaW50ZXJ2YWwgKiBlYXNlKSAvIDEwMDtcbiAgICAgICAgZWxzZSBpbnRlcnZhbCA9ICgxLjMgKiAoaW50ZXJ2YWwgKiBlYXNlKSkgLyAxMDA7XG5cbiAgICAgICAgcmV0dXJuIHsgZWFzZSwgaW50ZXJ2YWw6IE1hdGgucm91bmQoaW50ZXJ2YWwgKiAxMCkgLyAxMCB9O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZXNjYXBlUmVnRXhwKHN0cjogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7IC8vICQmIG1lYW5zIHRoZSB3aG9sZSBtYXRjaGVkIHN0cmluZ1xufVxuIiwiZXhwb3J0IGNvbnN0IFNDSEVEVUxJTkdfSU5GT19SRUdFWCA9IC9eLS0tXFxuKCg/Oi4qXFxuKSopc3ItZHVlOiAoWzAtOUEtWmEteiBdKylcXG5zci1pbnRlcnZhbDogKFxcZCspXFxuc3ItZWFzZTogKFxcZCspXFxuKCg/Oi4qXFxuKSopLS0tLztcbmV4cG9ydCBjb25zdCBZQU1MX0ZST05UX01BVFRFUl9SRUdFWCA9IC9eLS0tXFxuKCg/Oi4qXFxuKSopLS0tLztcbmV4cG9ydCBjb25zdCBTSU5HTEVMSU5FX0NBUkRfUkVHRVggPSAvXiguKyk6OiguKz8pXFxuPyg/OjwhLS1TUjooWzAtOUEtWmEteiBdKyksKFxcZCspLChcXGQrKS0tPnwkKS9nbTtcbmV4cG9ydCBjb25zdCBNVUxUSUxJTkVfQ0FSRF9SRUdFWCA9IC9eKCg/Oi4rXFxuKSspXFw/XFxuKCg/Oi4rXFxuKSs/KSg/OjwhLS1TUjooWzAtOUEtWmEteiBdKyksKFxcZCspLChcXGQrKS0tPnwkKS9nbTsgICAgICAgICAgICAgIFxuXG5leHBvcnQgY29uc3QgQ1JPU1NfSEFJUlNfSUNPTiA9IGA8cGF0aCBzdHlsZT1cIiBzdHJva2U6bm9uZTtmaWxsLXJ1bGU6bm9uemVybztmaWxsOmN1cnJlbnRDb2xvcjtmaWxsLW9wYWNpdHk6MTtcIiBkPVwiTSA5OS45MjE4NzUgNDcuOTQxNDA2IEwgOTMuMDc0MjE5IDQ3Ljk0MTQwNiBDIDkyLjg0Mzc1IDQyLjAzMTI1IDkxLjM5MDYyNSAzNi4yMzgyODEgODguODAwNzgxIDMwLjkyMTg3NSBMIDg1LjM2NzE4OCAzMi41ODIwMzEgQyA4Ny42Njc5NjkgMzcuMzU1NDY5IDg4Ljk2NDg0NCA0Mi41NTA3ODEgODkuMTgzNTk0IDQ3Ljg0Mzc1IEwgODIuMjM4MjgxIDQ3Ljg0Mzc1IEMgODIuMDk3NjU2IDQ0LjYxNzE4OCA4MS41ODk4NDQgNDEuNDE3OTY5IDgwLjczNDM3NSAzOC4zMDQ2ODggTCA3Ny4wNTA3ODEgMzkuMzM1OTM4IEMgNzcuODA4NTk0IDQyLjA4OTg0NCA3OC4yNjE3MTkgNDQuOTE3OTY5IDc4LjQwNjI1IDQ3Ljc2OTUzMSBMIDY1Ljg3MTA5NCA0Ny43Njk1MzEgQyA2NC45MTQwNjIgNDAuNTA3ODEyIDU5LjE0NDUzMSAzNC44MzIwMzEgNTEuODcxMDk0IDMzLjk5NjA5NCBMIDUxLjg3MTA5NCAyMS4zODY3MTkgQyA1NC44MTY0MDYgMjEuNTA3ODEyIDU3Ljc0MjE4OCAyMS45NjA5MzggNjAuNTg1OTM4IDIyLjczODI4MSBMIDYxLjYxNzE4OCAxOS4wNTg1OTQgQyA1OC40Mzc1IDE4LjE5MTQwNiA1NS4xNjQwNjIgMTcuNjkxNDA2IDUxLjg3MTA5NCAxNy41NzAzMTIgTCA1MS44NzEwOTQgMTAuNTUwNzgxIEMgNTcuMTY0MDYyIDEwLjc2OTUzMSA2Mi4zNTU0NjkgMTIuMDY2NDA2IDY3LjEzMjgxMiAxNC4zNjMyODEgTCA2OC43ODkwNjIgMTAuOTI5Njg4IEMgNjMuNSA4LjM4MjgxMiA1Ny43MzgyODEgNi45NTMxMjUgNTEuODcxMDk0IDYuNzM0Mzc1IEwgNTEuODcxMDk0IDAuMDM5MDYyNSBMIDQ4LjA1NDY4OCAwLjAzOTA2MjUgTCA0OC4wNTQ2ODggNi43MzQzNzUgQyA0Mi4xNzk2ODggNi45NzY1NjIgMzYuNDE3OTY5IDguNDMzNTk0IDMxLjEzMjgxMiAxMS4wMDc4MTIgTCAzMi43OTI5NjkgMTQuNDQxNDA2IEMgMzcuNTY2NDA2IDEyLjE0MDYyNSA0Mi43NjE3MTkgMTAuODQzNzUgNDguMDU0Njg4IDEwLjYyNSBMIDQ4LjA1NDY4OCAxNy41NzAzMTIgQyA0NC44MjgxMjUgMTcuNzE0ODQ0IDQxLjYyODkwNiAxOC4yMTg3NSAzOC41MTU2MjUgMTkuMDc4MTI1IEwgMzkuNTQ2ODc1IDIyLjc1NzgxMiBDIDQyLjMyNDIxOSAyMS45ODgyODEgNDUuMTc1NzgxIDIxLjUzMTI1IDQ4LjA1NDY4OCAyMS4zODY3MTkgTCA0OC4wNTQ2ODggMzQuMDMxMjUgQyA0MC43OTY4NzUgMzQuOTQ5MjE5IDM1LjA4OTg0NCA0MC42Nzk2ODggMzQuMjAzMTI1IDQ3Ljk0MTQwNiBMIDIxLjUgNDcuOTQxNDA2IEMgMjEuNjMyODEyIDQ1LjA0Mjk2OSAyMi4wODk4NDQgNDIuMTcxODc1IDIyLjg1NTQ2OSAzOS4zNzUgTCAxOS4xNzE4NzUgMzguMzQzNzUgQyAxOC4zMTI1IDQxLjQ1NzAzMSAxNy44MDg1OTQgNDQuNjU2MjUgMTcuNjY0MDYyIDQ3Ljg4MjgxMiBMIDEwLjY2NDA2MiA0Ny44ODI4MTIgQyAxMC44ODI4MTIgNDIuNTg5ODQ0IDEyLjE3OTY4OCAzNy4zOTQ1MzEgMTQuNDgwNDY5IDMyLjYyMTA5NCBMIDExLjEyMTA5NCAzMC45MjE4NzUgQyA4LjUzNTE1NiAzNi4yMzgyODEgNy4wNzgxMjUgNDIuMDMxMjUgNi44NDc2NTYgNDcuOTQxNDA2IEwgMCA0Ny45NDE0MDYgTCAwIDUxLjc1MzkwNiBMIDYuODQ3NjU2IDUxLjc1MzkwNiBDIDcuMDg5ODQ0IDU3LjYzNjcxOSA4LjU0Mjk2OSA2My40MDIzNDQgMTEuMTIxMDk0IDY4LjY5NTMxMiBMIDE0LjU1NDY4OCA2Ny4wMzUxNTYgQyAxMi4yNTc4MTIgNjIuMjYxNzE5IDEwLjk1NzAzMSA1Ny4wNjY0MDYgMTAuNzM4MjgxIDUxLjc3MzQzOCBMIDE3Ljc0MjE4OCA1MS43NzM0MzggQyAxNy44NTU0NjkgNTUuMDQyOTY5IDE4LjM0Mzc1IDU4LjI4OTA2MiAxOS4xOTE0MDYgNjEuNDQ1MzEyIEwgMjIuODcxMDk0IDYwLjQxNDA2MiBDIDIyLjA4OTg0NCA1Ny41NjI1IDIxLjYyODkwNiA1NC42MzI4MTIgMjEuNSA1MS42Nzk2ODggTCAzNC4yMDMxMjUgNTEuNjc5Njg4IEMgMzUuMDU4NTk0IDU4Ljk2ODc1IDQwLjc3MzQzOCA2NC43MzgyODEgNDguMDU0Njg4IDY1LjY2MDE1NiBMIDQ4LjA1NDY4OCA3OC4zMDg1OTQgQyA0NS4xMDU0NjkgNzguMTg3NSA0Mi4xODM1OTQgNzcuNzMwNDY5IDM5LjMzNTkzOCA3Ni45NTcwMzEgTCAzOC4zMDQ2ODggODAuNjM2NzE5IEMgNDEuNDg4MjgxIDgxLjUxMTcxOSA0NC43NTc4MTIgODIuMDE1NjI1IDQ4LjA1NDY4OCA4Mi4xNDQ1MzEgTCA0OC4wNTQ2ODggODkuMTQ0NTMxIEMgNDIuNzYxNzE5IDg4LjkyNTc4MSAzNy41NjY0MDYgODcuNjI4OTA2IDMyLjc5Mjk2OSA4NS4zMjgxMjUgTCAzMS4xMzI4MTIgODguNzY1NjI1IEMgMzYuNDI1NzgxIDkxLjMxMjUgNDIuMTgzNTk0IDkyLjc0MjE4OCA0OC4wNTQ2ODggOTIuOTYwOTM4IEwgNDguMDU0Njg4IDk5Ljk2MDkzOCBMIDUxLjg3MTA5NCA5OS45NjA5MzggTCA1MS44NzEwOTQgOTIuOTYwOTM4IEMgNTcuNzUgOTIuNzE4NzUgNjMuNTE5NTMxIDkxLjI2NTYyNSA2OC44MDg1OTQgODguNjg3NSBMIDY3LjEzMjgxMiA4NS4yNTM5MDYgQyA2Mi4zNTU0NjkgODcuNTUwNzgxIDU3LjE2NDA2MiA4OC44NTE1NjIgNTEuODcxMDk0IDg5LjA3MDMxMiBMIDUxLjg3MTA5NCA4Mi4xMjUgQyA1NS4wOTM3NSA4MS45ODA0NjkgNTguMjkyOTY5IDgxLjQ3NjU2MiA2MS40MDYyNSA4MC42MTcxODggTCA2MC4zNzg5MDYgNzYuOTM3NSBDIDU3LjU3NDIxOSA3Ny43MDMxMjUgNTQuNjk1MzEyIDc4LjE1NjI1IDUxLjc5Mjk2OSA3OC4yODkwNjIgTCA1MS43OTI5NjkgNjUuNjc5Njg4IEMgNTkuMTIxMDk0IDY0LjgyODEyNSA2NC45MTAxNTYgNTkuMDYyNSA2NS43OTY4NzUgNTEuNzM0Mzc1IEwgNzguMzY3MTg4IDUxLjczNDM3NSBDIDc4LjI1IDU0LjczNDM3NSA3Ny43ODkwNjIgNTcuNzEwOTM4IDc2Ljk5MjE4OCA2MC42MDU0NjkgTCA4MC42NzU3ODEgNjEuNjM2NzE5IEMgODEuNTU4NTk0IDU4LjQwNjI1IDgyLjA2NjQwNiA1NS4wODIwMzEgODIuMTgzNTk0IDUxLjczNDM3NSBMIDg5LjI2MTcxOSA1MS43MzQzNzUgQyA4OS4wNDI5NjkgNTcuMDMxMjUgODcuNzQyMTg4IDYyLjIyMjY1NiA4NS40NDUzMTIgNjYuOTk2MDk0IEwgODguODc4OTA2IDY4LjY1NjI1IEMgOTEuNDU3MDMxIDYzLjM2NzE4OCA5Mi45MTAxNTYgNTcuNTk3NjU2IDkzLjE1MjM0NCA1MS43MTg3NSBMIDEwMCA1MS43MTg3NSBaIE0gNjIuMDE5NTMxIDUxLjczNDM3NSBDIDYxLjE4MzU5NCA1Ni45NDUzMTIgNTcuMDg1OTM4IDYxLjAyMzQzOCA1MS44NzEwOTQgNjEuODI4MTI1IEwgNTEuODcxMDk0IDU3LjUxNTYyNSBMIDQ4LjA1NDY4OCA1Ny41MTU2MjUgTCA0OC4wNTQ2ODggNjEuODA4NTk0IEMgNDIuOTEwMTU2IDYwLjk0OTIxOSAzOC44ODY3MTkgNTYuOTAyMzQ0IDM4LjA1ODU5NCA1MS43NTM5MDYgTCA0Mi4zMzIwMzEgNTEuNzUzOTA2IEwgNDIuMzMyMDMxIDQ3Ljk0MTQwNiBMIDM4LjA1ODU5NCA0Ny45NDE0MDYgQyAzOC44ODY3MTkgNDIuNzg5MDYyIDQyLjkxMDE1NiAzOC43NDYwOTQgNDguMDU0Njg4IDM3Ljg4NjcxOSBMIDQ4LjA1NDY4OCA0Mi4xNzk2ODggTCA1MS44NzEwOTQgNDIuMTc5Njg4IEwgNTEuODcxMDk0IDM3Ljg0NzY1NiBDIDU3LjA3ODEyNSAzOC42NDg0MzggNjEuMTc5Njg4IDQyLjcxODc1IDYyLjAxOTUzMSA0Ny45MjE4NzUgTCA1Ny43MDcwMzEgNDcuOTIxODc1IEwgNTcuNzA3MDMxIDUxLjczNDM3NSBaIE0gNjIuMDE5NTMxIDUxLjczNDM3NSBcIi8+YDtcbmV4cG9ydCBjb25zdCBDT0xMQVBTRV9JQ09OID0gYDxzdmcgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgd2lkdGg9XCI4XCIgaGVpZ2h0PVwiOFwiIGNsYXNzPVwicmlnaHQtdHJpYW5nbGVcIj48cGF0aCBmaWxsPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgZD1cIk05NC45LDIwLjhjLTEuNC0yLjUtNC4xLTQuMS03LjEtNC4xSDEyLjJjLTMsMC01LjcsMS42LTcuMSw0LjFjLTEuMywyLjQtMS4yLDUuMiwwLjIsNy42TDQzLjEsODhjMS41LDIuMyw0LDMuNyw2LjksMy43IHM1LjQtMS40LDYuOS0zLjdsMzcuOC01OS42Qzk2LjEsMjYsOTYuMiwyMy4yLDk0LjksMjAuOEw5NC45LDIwLjh6XCI+PC9wYXRoPjwvc3ZnPmA7XG4iLCJpbXBvcnQgeyBJdGVtVmlldywgV29ya3NwYWNlTGVhZiwgTWVudSwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIFNSUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IENPTExBUFNFX0lDT04gfSBmcm9tIFwiLi9jb25zdGFudHNcIjtcblxuZXhwb3J0IGNvbnN0IFJFVklFV19RVUVVRV9WSUVXX1RZUEUgPSBcInJldmlldy1xdWV1ZS1saXN0LXZpZXdcIjtcblxuZXhwb3J0IGNsYXNzIFJldmlld1F1ZXVlTGlzdFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gICAgcHJpdmF0ZSBwbHVnaW46IFNSUGx1Z2luO1xuICAgIHByaXZhdGUgYWN0aXZlRm9sZGVyczogU2V0PHN0cmluZz47XG5cbiAgICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwbHVnaW46IFNSUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGxlYWYpO1xuXG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgICAgICB0aGlzLmFjdGl2ZUZvbGRlcnMgPSBuZXcgU2V0KFtcIlRvZGF5XCJdKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIChfOiBhbnkpID0+IHRoaXMucmVkcmF3KCkpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgICAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIChfOiBhbnkpID0+IHRoaXMucmVkcmF3KCkpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBSRVZJRVdfUVVFVUVfVklFV19UWVBFO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gXCJOb3RlcyBSZXZpZXcgUXVldWVcIjtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gXCJjcm9zc2hhaXJzXCI7XG4gICAgfVxuXG4gICAgcHVibGljIG9uSGVhZGVyTWVudShtZW51OiBNZW51KSB7XG4gICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgaXRlbS5zZXRUaXRsZShcIkNsb3NlXCIpXG4gICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc1wiKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShcbiAgICAgICAgICAgICAgICAgICAgICAgIFJFVklFV19RVUVVRV9WSUVXX1RZUEVcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIHJlZHJhdygpIHtcbiAgICAgICAgY29uc3Qgb3BlbkZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXG4gICAgICAgIGNvbnN0IHJvb3RFbCA9IGNyZWF0ZURpdihcIm5hdi1mb2xkZXIgbW9kLXJvb3RcIik7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuRWwgPSByb290RWwuY3JlYXRlRGl2KFwibmF2LWZvbGRlci1jaGlsZHJlblwiKTtcblxuICAgICAgICBpZiAodGhpcy5wbHVnaW4ubmV3Tm90ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vdGVzRm9sZGVyRWwgPSB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZvbGRlcihcbiAgICAgICAgICAgICAgICBjaGlsZHJlbkVsLFxuICAgICAgICAgICAgICAgIFwiTmV3XCIsXG4gICAgICAgICAgICAgICAgIXRoaXMuYWN0aXZlRm9sZGVycy5oYXMoXCJOZXdcIilcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IG5ld0ZpbGUgb2YgdGhpcy5wbHVnaW4ubmV3Tm90ZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZpbGUoXG4gICAgICAgICAgICAgICAgICAgIG5ld05vdGVzRm9sZGVyRWwsXG4gICAgICAgICAgICAgICAgICAgIG5ld0ZpbGUsXG4gICAgICAgICAgICAgICAgICAgIG9wZW5GaWxlICYmIG5ld0ZpbGUucGF0aCA9PT0gb3BlbkZpbGUucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgIXRoaXMuYWN0aXZlRm9sZGVycy5oYXMoXCJOZXdcIilcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLnNjaGVkdWxlZE5vdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBub3c6IG51bWJlciA9IERhdGUubm93KCk7XG4gICAgICAgICAgICBsZXQgY3VyclVuaXggPSAtMTtcbiAgICAgICAgICAgIGxldCBmb2xkZXJFbCwgZm9sZGVyVGl0bGU7XG5cbiAgICAgICAgICAgIGZvciAobGV0IHNOb3RlIG9mIHRoaXMucGx1Z2luLnNjaGVkdWxlZE5vdGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNOb3RlLmR1ZVVuaXggIT0gY3VyclVuaXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG5EYXlzID0gTWF0aC5jZWlsKFxuICAgICAgICAgICAgICAgICAgICAgICAgKHNOb3RlLmR1ZVVuaXggLSBub3cpIC8gKDI0ICogMzYwMCAqIDEwMDApXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGZvbGRlclRpdGxlID1cbiAgICAgICAgICAgICAgICAgICAgICAgIG5EYXlzID09IC0xXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIlllc3RlcmRheVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBuRGF5cyA9PSAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIlRvZGF5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IG5EYXlzID09IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiVG9tb3Jyb3dcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogbmV3IERhdGUoc05vdGUuZHVlVW5peCkudG9EYXRlU3RyaW5nKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9sZGVyRWwgPSB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZvbGRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuRWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb2xkZXJUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICF0aGlzLmFjdGl2ZUZvbGRlcnMuaGFzKGZvbGRlclRpdGxlKVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBjdXJyVW5peCA9IHNOb3RlLmR1ZVVuaXg7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVSaWdodFBhbmVGaWxlKFxuICAgICAgICAgICAgICAgICAgICBmb2xkZXJFbCxcbiAgICAgICAgICAgICAgICAgICAgc05vdGUubm90ZSxcbiAgICAgICAgICAgICAgICAgICAgb3BlbkZpbGUgJiYgc05vdGUubm90ZS5wYXRoID09PSBvcGVuRmlsZS5wYXRoLFxuICAgICAgICAgICAgICAgICAgICAhdGhpcy5hY3RpdmVGb2xkZXJzLmhhcyhmb2xkZXJUaXRsZSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGVudEVsID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAgICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgICAgIGNvbnRlbnRFbC5hcHBlbmRDaGlsZChyb290RWwpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlUmlnaHRQYW5lRm9sZGVyKFxuICAgICAgICBwYXJlbnRFbDogYW55LFxuICAgICAgICBmb2xkZXJUaXRsZTogc3RyaW5nLFxuICAgICAgICBjb2xsYXBzZWQ6IGJvb2xlYW5cbiAgICApOiBhbnkge1xuICAgICAgICBjb25zdCBmb2xkZXJFbCA9IHBhcmVudEVsLmNyZWF0ZURpdihcIm5hdi1mb2xkZXJcIik7XG4gICAgICAgIGNvbnN0IGZvbGRlclRpdGxlRWwgPSBmb2xkZXJFbC5jcmVhdGVEaXYoXCJuYXYtZm9sZGVyLXRpdGxlXCIpO1xuICAgICAgICBjb25zdCBjaGlsZHJlbkVsID0gZm9sZGVyRWwuY3JlYXRlRGl2KFwibmF2LWZvbGRlci1jaGlsZHJlblwiKTtcbiAgICAgICAgY29uc3QgY29sbGFwc2VJY29uRWwgPSBmb2xkZXJUaXRsZUVsLmNyZWF0ZURpdihcbiAgICAgICAgICAgIFwibmF2LWZvbGRlci1jb2xsYXBzZS1pbmRpY2F0b3IgY29sbGFwc2UtaWNvblwiXG4gICAgICAgICk7XG4gICAgICAgIGNvbGxhcHNlSWNvbkVsLmlubmVySFRNTCA9IENPTExBUFNFX0lDT047XG5cbiAgICAgICAgaWYgKGNvbGxhcHNlZClcbiAgICAgICAgICAgIGNvbGxhcHNlSWNvbkVsLmNoaWxkTm9kZXNbMF0uc3R5bGUudHJhbnNmb3JtID0gXCJyb3RhdGUoLTkwZGVnKVwiO1xuXG4gICAgICAgIGZvbGRlclRpdGxlRWxcbiAgICAgICAgICAgIC5jcmVhdGVEaXYoXCJuYXYtZm9sZGVyLXRpdGxlLWNvbnRlbnRcIilcbiAgICAgICAgICAgIC5zZXRUZXh0KGZvbGRlclRpdGxlKTtcblxuICAgICAgICBmb2xkZXJUaXRsZUVsLm9uQ2xpY2tFdmVudCgoXzogYW55KSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBjaGlsZCBvZiBjaGlsZHJlbkVsLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLmRpc3BsYXkgPT0gXCJibG9ja1wiIHx8XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLmRpc3BsYXkgPT0gXCJcIlxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxhcHNlSWNvbkVsLmNoaWxkTm9kZXNbMF0uc3R5bGUudHJhbnNmb3JtID1cbiAgICAgICAgICAgICAgICAgICAgICAgIFwicm90YXRlKC05MGRlZylcIjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hY3RpdmVGb2xkZXJzLmRlbGV0ZShmb2xkZXJUaXRsZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgICAgICAgICAgY29sbGFwc2VJY29uRWwuY2hpbGROb2Rlc1swXS5zdHlsZS50cmFuc2Zvcm0gPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZUZvbGRlcnMuYWRkKGZvbGRlclRpdGxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBjaGlsZHJlbkVsO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlUmlnaHRQYW5lRmlsZShcbiAgICAgICAgZm9sZGVyRWw6IGFueSxcbiAgICAgICAgZmlsZTogVEZpbGUsXG4gICAgICAgIGZpbGVFbEFjdGl2ZTogYm9vbGVhbixcbiAgICAgICAgaGlkZGVuOiBib29sZWFuXG4gICAgKSB7XG4gICAgICAgIGNvbnN0IG5hdkZpbGVFbCA9IGZvbGRlckVsLmNyZWF0ZURpdihcIm5hdi1maWxlXCIpO1xuICAgICAgICBpZiAoaGlkZGVuKSBuYXZGaWxlRWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG4gICAgICAgIGNvbnN0IG5hdkZpbGVUaXRsZSA9IG5hdkZpbGVFbC5jcmVhdGVEaXYoXCJuYXYtZmlsZS10aXRsZVwiKTtcbiAgICAgICAgaWYgKGZpbGVFbEFjdGl2ZSkgbmF2RmlsZVRpdGxlLmFkZENsYXNzKFwiaXMtYWN0aXZlXCIpO1xuXG4gICAgICAgIG5hdkZpbGVUaXRsZS5jcmVhdGVEaXYoXCJuYXYtZmlsZS10aXRsZS1jb250ZW50XCIpLnNldFRleHQoZmlsZS5iYXNlbmFtZSk7XG4gICAgICAgIG5hdkZpbGVUaXRsZS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgXCJjbGlja1wiLFxuICAgICAgICAgICAgKGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZi5vcGVuRmlsZShmaWxlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcblxuICAgICAgICBuYXZGaWxlVGl0bGUuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgIFwiY29udGV4dG1lbnVcIixcbiAgICAgICAgICAgIChldmVudDogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZU1lbnUgPSBuZXcgTWVudSh0aGlzLmFwcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoXG4gICAgICAgICAgICAgICAgICAgIFwiZmlsZS1tZW51XCIsXG4gICAgICAgICAgICAgICAgICAgIGZpbGVNZW51LFxuICAgICAgICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICAgICAgICBcIm15LWNvbnRleHQtbWVudVwiLFxuICAgICAgICAgICAgICAgICAgICBudWxsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBmaWxlTWVudS5zaG93QXRQb3NpdGlvbih7XG4gICAgICAgICAgICAgICAgICAgIHg6IGV2ZW50LnBhZ2VYLFxuICAgICAgICAgICAgICAgICAgICB5OiBldmVudC5wYWdlWSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBOb3RpY2UsIFBsdWdpbiwgYWRkSWNvbiwgVEZpbGUsIEhlYWRpbmdDYWNoZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgKiBhcyBncmFwaCBmcm9tIFwicGFnZXJhbmsuanNcIjtcclxuaW1wb3J0IHsgU1JTZXR0aW5ncywgU1JTZXR0aW5nVGFiLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgRmxhc2hjYXJkTW9kYWwgfSBmcm9tIFwiLi9mbGFzaGNhcmQtbW9kYWxcIjtcclxuaW1wb3J0IHsgUmV2aWV3UXVldWVMaXN0VmlldywgUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSB9IGZyb20gXCIuL3NpZGViYXJcIjtcclxuaW1wb3J0IHtcclxuICAgIENST1NTX0hBSVJTX0lDT04sXHJcbiAgICBTQ0hFRFVMSU5HX0lORk9fUkVHRVgsXHJcbiAgICBZQU1MX0ZST05UX01BVFRFUl9SRUdFWCxcclxuICAgIFNJTkdMRUxJTkVfQ0FSRF9SRUdFWCxcclxuICAgIE1VTFRJTElORV9DQVJEX1JFR0VYLFxyXG59IGZyb20gXCIuL2NvbnN0YW50c1wiO1xyXG5cclxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xyXG4gICAgc2V0dGluZ3M6IFNSU2V0dGluZ3M7XHJcbn1cclxuXHJcbmNvbnN0IERFRkFVTFRfREFUQTogUGx1Z2luRGF0YSA9IHtcclxuICAgIHNldHRpbmdzOiBERUZBVUxUX1NFVFRJTkdTLFxyXG59O1xyXG5cclxuaW50ZXJmYWNlIFNjaGVkTm90ZSB7XHJcbiAgICBub3RlOiBURmlsZTtcclxuICAgIGR1ZVVuaXg6IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIExpbmtTdGF0IHtcclxuICAgIHNvdXJjZVBhdGg6IHN0cmluZztcclxuICAgIGxpbmtDb3VudDogbnVtYmVyO1xyXG59XHJcblxyXG5lbnVtIFJldmlld1Jlc3BvbnNlIHtcclxuICAgIEVhc3ksXHJcbiAgICBHb29kLFxyXG4gICAgSGFyZCxcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkIHtcclxuICAgIGR1ZT86IHN0cmluZztcclxuICAgIGVhc2U/OiBudW1iZXI7XHJcbiAgICBpbnRlcnZhbD86IG51bWJlcjtcclxuICAgIGNvbnRleHQ/OiBzdHJpbmc7XHJcbiAgICBub3RlOiBURmlsZTtcclxuICAgIGZyb250OiBzdHJpbmc7XHJcbiAgICBiYWNrOiBzdHJpbmc7XHJcbiAgICBtYXRjaDogYW55O1xyXG4gICAgaXNTaW5nbGVMaW5lOiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTUlBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgICBwcml2YXRlIHN0YXR1c0JhcjogSFRNTEVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIHJldmlld1F1ZXVlVmlldzogUmV2aWV3UXVldWVMaXN0VmlldztcclxuICAgIHB1YmxpYyBkYXRhOiBQbHVnaW5EYXRhO1xyXG5cclxuICAgIHB1YmxpYyBuZXdOb3RlczogVEZpbGVbXSA9IFtdO1xyXG4gICAgcHVibGljIHNjaGVkdWxlZE5vdGVzOiBTY2hlZE5vdGVbXSA9IFtdO1xyXG4gICAgcHJpdmF0ZSBlYXNlQnlQYXRoOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XHJcbiAgICBwcml2YXRlIGluY29taW5nTGlua3M6IFJlY29yZDxzdHJpbmcsIExpbmtTdGF0W10+ID0ge307XHJcbiAgICBwcml2YXRlIHBhZ2VyYW5rczogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xyXG4gICAgcHJpdmF0ZSBkdWVOb3Rlc0NvdW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIHB1YmxpYyBuZXdGbGFzaGNhcmRzOiBDYXJkW10gPSBbXTtcclxuICAgIHB1YmxpYyBkdWVGbGFzaGNhcmRzOiBDYXJkW10gPSBbXTtcclxuXHJcbiAgICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkUGx1Z2luRGF0YSgpO1xyXG5cclxuICAgICAgICBhZGRJY29uKFwiY3Jvc3NoYWlyc1wiLCBDUk9TU19IQUlSU19JQ09OKTtcclxuXHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIgPSB0aGlzLmFkZFN0YXR1c0Jhckl0ZW0oKTtcclxuICAgICAgICB0aGlzLnN0YXR1c0Jhci5jbGFzc0xpc3QuYWRkKFwibW9kLWNsaWNrYWJsZVwiKTtcclxuICAgICAgICB0aGlzLnN0YXR1c0Jhci5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIFwiT3BlbiBhIG5vdGUgZm9yIHJldmlld1wiKTtcclxuICAgICAgICB0aGlzLnN0YXR1c0Jhci5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsLXBvc2l0aW9uXCIsIFwidG9wXCIpO1xyXG4gICAgICAgIHRoaXMuc3RhdHVzQmFyLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoXzogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuc3luYygpO1xyXG4gICAgICAgICAgICB0aGlzLnJldmlld05leHROb3RlKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuYWRkUmliYm9uSWNvbihcImNyb3NzaGFpcnNcIiwgXCJSZXZpZXcgZmxhc2hjYXJkc1wiLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZmxhc2hjYXJkc19zeW5jKCk7XHJcbiAgICAgICAgICAgIG5ldyBGbGFzaGNhcmRNb2RhbCh0aGlzLmFwcCwgdGhpcykub3BlbigpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLnJlZ2lzdGVyVmlldyhcclxuICAgICAgICAgICAgUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSxcclxuICAgICAgICAgICAgKGxlYWYpID0+XHJcbiAgICAgICAgICAgICAgICAodGhpcy5yZXZpZXdRdWV1ZVZpZXcgPSBuZXcgUmV2aWV3UXVldWVMaXN0VmlldyhsZWFmLCB0aGlzKSlcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImZpbGUtbWVudVwiLCAobWVudSwgZmlsZTogVEZpbGUpID0+IHtcclxuICAgICAgICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uc2V0VGl0bGUoXCJSZXZpZXc6IEVhc3lcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc2hhaXJzXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKChldnQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldmlld1Jlc3BvbnNlLkVhc3lcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uc2V0VGl0bGUoXCJSZXZpZXc6IEdvb2RcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc2hhaXJzXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKChldnQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldmlld1Jlc3BvbnNlLkdvb2RcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uc2V0VGl0bGUoXCJSZXZpZXc6IEhhcmRcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc2hhaXJzXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKChldnQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldmlld1Jlc3BvbnNlLkhhcmRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICk7XHJcblxyXG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgICAgICAgIGlkOiBcIm5vdGUtcmV2aWV3LW9wZW4tbm90ZVwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIk9wZW4gYSBub3RlIGZvciByZXZpZXdcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3luYygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZXZpZXdOZXh0Tm90ZSgpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogXCJub3RlLXJldmlldy1lYXN5XCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiUmV2aWV3IG5vdGUgYXMgZWFzeVwiLFxyXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlbkZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKG9wZW5GaWxlICYmIG9wZW5GaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2Uob3BlbkZpbGUsIFJldmlld1Jlc3BvbnNlLkVhc3kpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogXCJub3RlLXJldmlldy1nb29kXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiUmV2aWV3IG5vdGUgYXMgZ29vZFwiLFxyXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlbkZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKG9wZW5GaWxlICYmIG9wZW5GaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2Uob3BlbkZpbGUsIFJldmlld1Jlc3BvbnNlLkdvb2QpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogXCJub3RlLXJldmlldy1oYXJkXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiUmV2aWV3IG5vdGUgYXMgaGFyZFwiLFxyXG4gICAgICAgICAgICBjYWxsYmFjazogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlbkZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKG9wZW5GaWxlICYmIG9wZW5GaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2Uob3BlbkZpbGUsIFJldmlld1Jlc3BvbnNlLkhhcmQpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IFNSU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xyXG5cclxuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuaW5pdFZpZXcoKTtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLnN5bmMoKSwgMjAwMCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc3luYygpIHtcclxuICAgICAgICBsZXQgbm90ZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XHJcblxyXG4gICAgICAgIGdyYXBoLnJlc2V0KCk7XHJcbiAgICAgICAgdGhpcy5zY2hlZHVsZWROb3RlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuZWFzZUJ5UGF0aCA9IHt9O1xyXG4gICAgICAgIHRoaXMubmV3Tm90ZXMgPSBbXTtcclxuICAgICAgICB0aGlzLmluY29taW5nTGlua3MgPSB7fTtcclxuICAgICAgICB0aGlzLnBhZ2VyYW5rcyA9IHt9O1xyXG4gICAgICAgIHRoaXMuZHVlTm90ZXNDb3VudCA9IDA7XHJcblxyXG4gICAgICAgIGxldCBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIGZvciAobGV0IG5vdGUgb2Ygbm90ZXMpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaW5jb21pbmdMaW5rc1tub3RlLnBhdGhdID09IHVuZGVmaW5lZClcclxuICAgICAgICAgICAgICAgIHRoaXMuaW5jb21pbmdMaW5rc1tub3RlLnBhdGhdID0gW107XHJcblxyXG4gICAgICAgICAgICBsZXQgbGlua3MgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLnJlc29sdmVkTGlua3Nbbm90ZS5wYXRoXSB8fCB7fTtcclxuICAgICAgICAgICAgZm9yIChsZXQgdGFyZ2V0UGF0aCBpbiBsaW5rcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaW5jb21pbmdMaW5rc1t0YXJnZXRQYXRoXSA9PSB1bmRlZmluZWQpXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0xpbmtzW3RhcmdldFBhdGhdID0gW107XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gbWFya2Rvd24gZmlsZXMgb25seVxyXG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldFBhdGguc3BsaXQoXCIuXCIpLnBvcCgpLnRvTG93ZXJDYXNlKCkgPT0gXCJtZFwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0xpbmtzW3RhcmdldFBhdGhdLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VQYXRoOiBub3RlLnBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmtDb3VudDogbGlua3NbdGFyZ2V0UGF0aF0sXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGdyYXBoLmxpbmsobm90ZS5wYXRoLCB0YXJnZXRQYXRoLCBsaW5rc1t0YXJnZXRQYXRoXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBmaWxlQ2FjaGVkRGF0YSA9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShub3RlKSB8fCB7fTtcclxuICAgICAgICAgICAgbGV0IGZyb250bWF0dGVyID1cclxuICAgICAgICAgICAgICAgIGZpbGVDYWNoZWREYXRhLmZyb250bWF0dGVyIHx8IDxSZWNvcmQ8c3RyaW5nLCBhbnk+Pnt9O1xyXG4gICAgICAgICAgICBsZXQgdGFncyA9IGZpbGVDYWNoZWREYXRhLnRhZ3MgfHwgW107XHJcblxyXG4gICAgICAgICAgICBsZXQgc2hvdWxkSWdub3JlID0gdHJ1ZTtcclxuICAgICAgICAgICAgZm9yIChsZXQgdGFnT2JqIG9mIHRhZ3MpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuc2V0dGluZ3MudGFnc1RvUmV2aWV3LmluY2x1ZGVzKHRhZ09iai50YWcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2hvdWxkSWdub3JlID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChmcm9udG1hdHRlci50YWdzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZyb250bWF0dGVyLnRhZ3MgPT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5pbmNsdWRlcyhcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiI1wiICsgZnJvbnRtYXR0ZXIudGFnc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRJZ25vcmUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdGFnIG9mIGZyb250bWF0dGVyLnRhZ3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5pbmNsdWRlcyhcIiNcIiArIHRhZylcclxuICAgICAgICAgICAgICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG91bGRJZ25vcmUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoc2hvdWxkSWdub3JlKSBjb250aW51ZTtcclxuXHJcbiAgICAgICAgICAgIC8vIGZpbGUgaGFzIG5vIHNjaGVkdWxpbmcgaW5mb3JtYXRpb25cclxuICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgIShcclxuICAgICAgICAgICAgICAgICAgICBmcm9udG1hdHRlci5oYXNPd25Qcm9wZXJ0eShcInNyLWR1ZVwiKSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItaW50ZXJ2YWxcIikgJiZcclxuICAgICAgICAgICAgICAgICAgICBmcm9udG1hdHRlci5oYXNPd25Qcm9wZXJ0eShcInNyLWVhc2VcIilcclxuICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm5ld05vdGVzLnB1c2gobm90ZSk7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgbGV0IGR1ZVVuaXg6IG51bWJlciA9IERhdGUucGFyc2UoZnJvbnRtYXR0ZXJbXCJzci1kdWVcIl0pO1xyXG4gICAgICAgICAgICB0aGlzLnNjaGVkdWxlZE5vdGVzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgIGR1ZVVuaXgsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5lYXNlQnlQYXRoW25vdGUucGF0aF0gPSBmcm9udG1hdHRlcltcInNyLWVhc2VcIl07XHJcblxyXG4gICAgICAgICAgICBpZiAoZHVlVW5peCA8PSBub3cpIHRoaXMuZHVlTm90ZXNDb3VudCsrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JhcGgucmFuaygwLjg1LCAwLjAwMDAwMSwgKG5vZGU6IHN0cmluZywgcmFuazogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGFnZXJhbmtzW25vZGVdID0gcmFuayAqIDEwMDAwO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBzb3J0IG5ldyBub3RlcyBieSBpbXBvcnRhbmNlXHJcbiAgICAgICAgdGhpcy5uZXdOb3RlcyA9IHRoaXMubmV3Tm90ZXMuc29ydChcclxuICAgICAgICAgICAgKGE6IFRGaWxlLCBiOiBURmlsZSkgPT5cclxuICAgICAgICAgICAgICAgICh0aGlzLnBhZ2VyYW5rc1tiLnBhdGhdIHx8IDApIC0gKHRoaXMucGFnZXJhbmtzW2EucGF0aF0gfHwgMClcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyBzb3J0IHNjaGVkdWxlZCBub3RlcyBieSBkYXRlICYgd2l0aGluIHRob3NlIGRheXMsIHNvcnQgdGhlbSBieSBpbXBvcnRhbmNlXHJcbiAgICAgICAgdGhpcy5zY2hlZHVsZWROb3RlcyA9IHRoaXMuc2NoZWR1bGVkTm90ZXMuc29ydChcclxuICAgICAgICAgICAgKGE6IFNjaGVkTm90ZSwgYjogU2NoZWROb3RlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYS5kdWVVbml4IC0gYi5kdWVVbml4O1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAhPSAwKSByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAodGhpcy5wYWdlcmFua3NbYi5ub3RlLnBhdGhdIHx8IDApIC1cclxuICAgICAgICAgICAgICAgICAgICAodGhpcy5wYWdlcmFua3NbYS5ub3RlLnBhdGhdIHx8IDApXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0VGV4dChgUmV2aWV3OiAke3RoaXMuZHVlTm90ZXNDb3VudH0gbm90ZXMgZHVlYCk7XHJcbiAgICAgICAgdGhpcy5yZXZpZXdRdWV1ZVZpZXcucmVkcmF3KCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2F2ZVJldmlld1Jlc3BvbnNlKG5vdGU6IFRGaWxlLCByZXNwb25zZTogUmV2aWV3UmVzcG9uc2UpIHtcclxuICAgICAgICBsZXQgZmlsZUNhY2hlZERhdGEgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShub3RlKSB8fCB7fTtcclxuICAgICAgICBsZXQgZnJvbnRtYXR0ZXIgPSBmaWxlQ2FjaGVkRGF0YS5mcm9udG1hdHRlciB8fCA8UmVjb3JkPHN0cmluZywgYW55Pj57fTtcclxuXHJcbiAgICAgICAgbGV0IHRhZ3MgPSBmaWxlQ2FjaGVkRGF0YS50YWdzIHx8IFtdO1xyXG4gICAgICAgIGxldCBzaG91bGRJZ25vcmUgPSB0cnVlO1xyXG4gICAgICAgIGZvciAobGV0IHRhZ09iaiBvZiB0YWdzKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuc2V0dGluZ3MudGFnc1RvUmV2aWV3LmluY2x1ZGVzKHRhZ09iai50YWcpKSB7XHJcbiAgICAgICAgICAgICAgICBzaG91bGRJZ25vcmUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoc2hvdWxkSWdub3JlKSB7XHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXHJcbiAgICAgICAgICAgICAgICBcIlBsZWFzZSB0YWcgdGhlIG5vdGUgYXBwcm9wcmlhdGVseSBmb3IgcmV2aWV3aW5nIChpbiBzZXR0aW5ncykuXCJcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZpbGVUZXh0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChub3RlKTtcclxuICAgICAgICBsZXQgZWFzZSwgaW50ZXJ2YWw7XHJcbiAgICAgICAgLy8gbmV3IG5vdGVcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICEoXHJcbiAgICAgICAgICAgICAgICBmcm9udG1hdHRlci5oYXNPd25Qcm9wZXJ0eShcInNyLWR1ZVwiKSAmJlxyXG4gICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1pbnRlcnZhbFwiKSAmJlxyXG4gICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1lYXNlXCIpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgbGV0IGxpbmtUb3RhbCA9IDAsXHJcbiAgICAgICAgICAgICAgICBsaW5rUEdUb3RhbCA9IDAsXHJcbiAgICAgICAgICAgICAgICB0b3RhbExpbmtDb3VudCA9IDA7XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBzdGF0T2JqIG9mIHRoaXMuaW5jb21pbmdMaW5rc1tub3RlLnBhdGhdKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZWFzZSA9IHRoaXMuZWFzZUJ5UGF0aFtzdGF0T2JqLnNvdXJjZVBhdGhdO1xyXG4gICAgICAgICAgICAgICAgaWYgKGVhc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBsaW5rVG90YWwgKz1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdE9iai5saW5rQ291bnQgKlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2VyYW5rc1tzdGF0T2JqLnNvdXJjZVBhdGhdICpcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWFzZTtcclxuICAgICAgICAgICAgICAgICAgICBsaW5rUEdUb3RhbCArPVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2VyYW5rc1tzdGF0T2JqLnNvdXJjZVBhdGhdICogc3RhdE9iai5saW5rQ291bnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdG90YWxMaW5rQ291bnQgKz0gc3RhdE9iai5saW5rQ291bnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBvdXRnb2luZ0xpbmtzID1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUucmVzb2x2ZWRMaW5rc1tub3RlLnBhdGhdIHx8IHt9O1xyXG4gICAgICAgICAgICBmb3IgKGxldCBsaW5rZWRGaWxlUGF0aCBpbiBvdXRnb2luZ0xpbmtzKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZWFzZSA9IHRoaXMuZWFzZUJ5UGF0aFtsaW5rZWRGaWxlUGF0aF07XHJcbiAgICAgICAgICAgICAgICBpZiAoZWFzZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxpbmtUb3RhbCArPVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRnb2luZ0xpbmtzW2xpbmtlZEZpbGVQYXRoXSAqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZXJhbmtzW2xpbmtlZEZpbGVQYXRoXSAqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVhc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgbGlua1BHVG90YWwgKz1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlcmFua3NbbGlua2VkRmlsZVBhdGhdICpcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0Z29pbmdMaW5rc1tsaW5rZWRGaWxlUGF0aF07XHJcbiAgICAgICAgICAgICAgICAgICAgdG90YWxMaW5rQ291bnQgKz0gb3V0Z29pbmdMaW5rc1tsaW5rZWRGaWxlUGF0aF07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBsaW5rQ29udHJpYnV0aW9uID1cclxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5zZXR0aW5ncy5tYXhMaW5rRmFjdG9yICpcclxuICAgICAgICAgICAgICAgIE1hdGgubWluKDEuMCwgTWF0aC5sb2codG90YWxMaW5rQ291bnQgKyAwLjUpIC8gTWF0aC5sb2coNjQpKTtcclxuICAgICAgICAgICAgZWFzZSA9IE1hdGgucm91bmQoXHJcbiAgICAgICAgICAgICAgICAoMS4wIC0gbGlua0NvbnRyaWJ1dGlvbikgKiB0aGlzLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2UgK1xyXG4gICAgICAgICAgICAgICAgICAgICh0b3RhbExpbmtDb3VudCA+IDBcclxuICAgICAgICAgICAgICAgICAgICAgICAgPyAobGlua0NvbnRyaWJ1dGlvbiAqIGxpbmtUb3RhbCkgLyBsaW5rUEdUb3RhbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGxpbmtDb250cmlidXRpb24gKiB0aGlzLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2UpXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIGludGVydmFsID0gMTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpbnRlcnZhbCA9IGZyb250bWF0dGVyW1wic3ItaW50ZXJ2YWxcIl07XHJcbiAgICAgICAgICAgIGVhc2UgPSBmcm9udG1hdHRlcltcInNyLWVhc2VcIl07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAocmVzcG9uc2UgIT0gUmV2aWV3UmVzcG9uc2UuR29vZCkge1xyXG4gICAgICAgICAgICBlYXNlID1cclxuICAgICAgICAgICAgICAgIHJlc3BvbnNlID09IFJldmlld1Jlc3BvbnNlLkVhc3lcclxuICAgICAgICAgICAgICAgICAgICA/IGVhc2UgKyAyMFxyXG4gICAgICAgICAgICAgICAgICAgIDogTWF0aC5tYXgoMTMwLCBlYXNlIC0gMjApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHJlc3BvbnNlID09IFJldmlld1Jlc3BvbnNlLkhhcmQpXHJcbiAgICAgICAgICAgIGludGVydmFsID0gTWF0aC5tYXgoXHJcbiAgICAgICAgICAgICAgICAxLFxyXG4gICAgICAgICAgICAgICAgaW50ZXJ2YWwgKiB0aGlzLmRhdGEuc2V0dGluZ3MubGFwc2VzSW50ZXJ2YWxDaGFuZ2VcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICBlbHNlIGlmIChyZXNwb25zZSA9PSBSZXZpZXdSZXNwb25zZS5Hb29kKVxyXG4gICAgICAgICAgICBpbnRlcnZhbCA9IChpbnRlcnZhbCAqIGVhc2UpIC8gMTAwO1xyXG4gICAgICAgIGVsc2UgaW50ZXJ2YWwgPSAoMS4zICogKGludGVydmFsICogZWFzZSkpIC8gMTAwO1xyXG5cclxuICAgICAgICAvLyBmdXp6XHJcbiAgICAgICAgaWYgKGludGVydmFsID49IDgpIHtcclxuICAgICAgICAgICAgbGV0IGZ1enogPSBbLTAuMDUgKiBpbnRlcnZhbCwgMCwgMC4wNSAqIGludGVydmFsXTtcclxuICAgICAgICAgICAgaW50ZXJ2YWwgKz0gZnV6eltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmdXp6Lmxlbmd0aCldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpbnRlcnZhbCA9IE1hdGgucm91bmQoaW50ZXJ2YWwpO1xyXG5cclxuICAgICAgICBsZXQgZHVlID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIGludGVydmFsICogMjQgKiAzNjAwICogMTAwMCk7XHJcblxyXG4gICAgICAgIC8vIGNoZWNrIGlmIHNjaGVkdWxpbmcgaW5mbyBleGlzdHNcclxuICAgICAgICBpZiAoU0NIRURVTElOR19JTkZPX1JFR0VYLnRlc3QoZmlsZVRleHQpKSB7XHJcbiAgICAgICAgICAgIGxldCBzY2hlZHVsaW5nSW5mbyA9IFNDSEVEVUxJTkdfSU5GT19SRUdFWC5leGVjKGZpbGVUZXh0KTtcclxuICAgICAgICAgICAgZmlsZVRleHQgPSBmaWxlVGV4dC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAgICAgU0NIRURVTElOR19JTkZPX1JFR0VYLFxyXG4gICAgICAgICAgICAgICAgYC0tLVxcbiR7XHJcbiAgICAgICAgICAgICAgICAgICAgc2NoZWR1bGluZ0luZm9bMV1cclxuICAgICAgICAgICAgICAgIH1zci1kdWU6ICR7ZHVlLnRvRGF0ZVN0cmluZygpfVxcbnNyLWludGVydmFsOiAke2ludGVydmFsfVxcbnNyLWVhc2U6ICR7ZWFzZX1cXG4ke1xyXG4gICAgICAgICAgICAgICAgICAgIHNjaGVkdWxpbmdJbmZvWzVdXHJcbiAgICAgICAgICAgICAgICB9LS0tYFxyXG4gICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgLy8gbmV3IG5vdGUgd2l0aCBleGlzdGluZyBZQU1MIGZyb250IG1hdHRlclxyXG4gICAgICAgIH0gZWxzZSBpZiAoWUFNTF9GUk9OVF9NQVRURVJfUkVHRVgudGVzdChmaWxlVGV4dCkpIHtcclxuICAgICAgICAgICAgbGV0IGV4aXN0aW5nWWFtbCA9IFlBTUxfRlJPTlRfTUFUVEVSX1JFR0VYLmV4ZWMoZmlsZVRleHQpO1xyXG4gICAgICAgICAgICBmaWxlVGV4dCA9IGZpbGVUZXh0LnJlcGxhY2UoXHJcbiAgICAgICAgICAgICAgICBZQU1MX0ZST05UX01BVFRFUl9SRUdFWCxcclxuICAgICAgICAgICAgICAgIGAtLS1cXG4ke1xyXG4gICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nWWFtbFsxXVxyXG4gICAgICAgICAgICAgICAgfXNyLWR1ZTogJHtkdWUudG9EYXRlU3RyaW5nKCl9XFxuc3ItaW50ZXJ2YWw6ICR7aW50ZXJ2YWx9XFxuc3ItZWFzZTogJHtlYXNlfVxcbi0tLWBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWxlVGV4dCA9IGAtLS1cXG5zci1kdWU6ICR7ZHVlLnRvRGF0ZVN0cmluZygpfVxcbnNyLWludGVydmFsOiAke2ludGVydmFsfVxcbnNyLWVhc2U6ICR7ZWFzZX1cXG4tLS1cXG5cXG4ke2ZpbGVUZXh0fWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFwcC52YXVsdC5tb2RpZnkobm90ZSwgZmlsZVRleHQpO1xyXG5cclxuICAgICAgICBuZXcgTm90aWNlKFwiUmVzcG9uc2UgcmVjZWl2ZWQuXCIpO1xyXG5cclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5zeW5jKCk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuc2V0dGluZ3MuYXV0b05leHROb3RlKSB0aGlzLnJldmlld05leHROb3RlKCk7XHJcbiAgICAgICAgfSwgNTAwKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyByZXZpZXdOZXh0Tm90ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5kdWVOb3Rlc0NvdW50ID4gMCkge1xyXG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmRhdGEuc2V0dGluZ3Mub3BlblJhbmRvbU5vdGVcclxuICAgICAgICAgICAgICAgID8gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5kdWVOb3Rlc0NvdW50KVxyXG4gICAgICAgICAgICAgICAgOiAwO1xyXG4gICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZi5vcGVuRmlsZShcclxuICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVkTm90ZXNbaW5kZXhdLm5vdGVcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubmV3Tm90ZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmRhdGEuc2V0dGluZ3Mub3BlblJhbmRvbU5vdGVcclxuICAgICAgICAgICAgICAgID8gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5uZXdOb3Rlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICA6IDA7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLm9wZW5GaWxlKHRoaXMubmV3Tm90ZXNbaW5kZXhdKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbmV3IE5vdGljZShcIllvdSdyZSBkb25lIGZvciB0aGUgZGF5IDpELlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBmbGFzaGNhcmRzX3N5bmMoKSB7XHJcbiAgICAgICAgbGV0IG5vdGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xyXG5cclxuICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHMgPSBbXTtcclxuICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHMgPSBbXTtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgbm90ZSBvZiBub3Rlcykge1xyXG4gICAgICAgICAgICBsZXQgZmlsZUNhY2hlZERhdGEgPVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUobm90ZSkgfHwge307XHJcbiAgICAgICAgICAgIGxldCBmcm9udG1hdHRlciA9XHJcbiAgICAgICAgICAgICAgICBmaWxlQ2FjaGVkRGF0YS5mcm9udG1hdHRlciB8fCA8UmVjb3JkPHN0cmluZywgYW55Pj57fTtcclxuICAgICAgICAgICAgbGV0IHRhZ3MgPSBmaWxlQ2FjaGVkRGF0YS50YWdzIHx8IFtdO1xyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgdGFnT2JqIG9mIHRhZ3MpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0YWdPYmoudGFnID09IHRoaXMuZGF0YS5zZXR0aW5ncy5mbGFzaGNhcmRzVGFnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5maW5kRmxhc2hjYXJkcyhub3RlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGZyb250bWF0dGVyLnRhZ3MpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZnJvbnRtYXR0ZXIudGFncyA9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkc1RhZyA9PVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiNcIiArIGZyb250bWF0dGVyLnRhZ3NcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZmluZEZsYXNoY2FyZHMobm90ZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHRhZyBvZiBmcm9udG1hdHRlci50YWdzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkc1RhZyA9PSBcIiNcIiArIHRhZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5maW5kRmxhc2hjYXJkcyhub3RlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGZpbmRGbGFzaGNhcmRzKG5vdGU6IFRGaWxlKSB7XHJcbiAgICAgICAgbGV0IGZpbGVUZXh0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChub3RlKTtcclxuICAgICAgICBsZXQgZmlsZUNhY2hlZERhdGEgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShub3RlKSB8fCB7fTtcclxuICAgICAgICBsZXQgaGVhZGluZ3MgPSBmaWxlQ2FjaGVkRGF0YS5oZWFkaW5ncyB8fCBbXTtcclxuXHJcbiAgICAgICAgbGV0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgZm9yIChsZXQgcmVnZXggb2YgW1NJTkdMRUxJTkVfQ0FSRF9SRUdFWCwgTVVMVElMSU5FX0NBUkRfUkVHRVhdKSB7XHJcbiAgICAgICAgICAgIGxldCBpc1NpbmdsZUxpbmUgPSByZWdleCA9PSBTSU5HTEVMSU5FX0NBUkRfUkVHRVg7XHJcbiAgICAgICAgICAgIGZvciAobGV0IG1hdGNoIG9mIGZpbGVUZXh0Lm1hdGNoQWxsKHJlZ2V4KSkge1xyXG4gICAgICAgICAgICAgICAgbWF0Y2hbMF0gPSBtYXRjaFswXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBtYXRjaFsxXSA9IG1hdGNoWzFdLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgIG1hdGNoWzJdID0gbWF0Y2hbMl0udHJpbSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBjYXJkT2JqOiBDYXJkO1xyXG4gICAgICAgICAgICAgICAgLy8gZmxhc2hjYXJkIGFscmVhZHkgc2NoZWR1bGVkXHJcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hbM10pIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoRGF0ZS5wYXJzZShtYXRjaFszXSkgPD0gbm93KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhcmRPYmogPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9udDogbWF0Y2hbMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrOiBtYXRjaFsyXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWU6IG1hdGNoWzNdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWw6IHBhcnNlSW50KG1hdGNoWzRdKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVhc2U6IHBhcnNlSW50KG1hdGNoWzVdKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNTaW5nbGVMaW5lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHMucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRPYmogPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb250OiBtYXRjaFsxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmFjazogbWF0Y2hbMl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBub3RlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1NpbmdsZUxpbmUsXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHMucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBsZXQgY2FyZE9mZnNldCA9IG1hdGNoLmluZGV4O1xyXG4gICAgICAgICAgICAgICAgbGV0IHN0YWNrOiBIZWFkaW5nQ2FjaGVbXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaGVhZGluZyBvZiBoZWFkaW5ncykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChoZWFkaW5nLnBvc2l0aW9uLnN0YXJ0Lm9mZnNldCA+IGNhcmRPZmZzZXQpIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YWNrLmxlbmd0aCA+IDAgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0ubGV2ZWwgPj0gaGVhZGluZy5sZXZlbFxyXG4gICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2sucG9wKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHN0YWNrLnB1c2goaGVhZGluZyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY2FyZE9iai5jb250ZXh0ID0gXCJcIjtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGhlYWRpbmdPYmogb2Ygc3RhY2spXHJcbiAgICAgICAgICAgICAgICAgICAgY2FyZE9iai5jb250ZXh0ICs9IGhlYWRpbmdPYmouaGVhZGluZyArIFwiID4gXCI7XHJcbiAgICAgICAgICAgICAgICBjYXJkT2JqLmNvbnRleHQgPSBjYXJkT2JqLmNvbnRleHQuc2xpY2UoMCwgLTMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGxvYWRQbHVnaW5EYXRhKCkge1xyXG4gICAgICAgIHRoaXMuZGF0YSA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfREFUQSwgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzYXZlUGx1Z2luRGF0YSgpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgaW5pdFZpZXcoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpLnNldFZpZXdTdGF0ZSh7XHJcbiAgICAgICAgICAgIHR5cGU6IFJFVklFV19RVUVVRV9WSUVXX1RZUEUsXHJcbiAgICAgICAgICAgIGFjdGl2ZTogdHJ1ZSxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG4iXSwibmFtZXMiOlsiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJOb3RpY2UiLCJNb2RhbCIsIk1hcmtkb3duUmVuZGVyZXIiLCJJdGVtVmlldyIsIk1lbnUiLCJQbHVnaW4iLCJhZGRJY29uIiwiZ3JhcGgucmVzZXQiLCJncmFwaC5saW5rIiwiZ3JhcGgucmFuayJdLCJtYXBwaW5ncyI6Ijs7OztBQUVBLFNBQVMsTUFBTSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUU7QUFDbEMsSUFBSSxJQUFJLENBQUMsT0FBTyxNQUFNLEtBQUssUUFBUSxNQUFNLE9BQU8sUUFBUSxLQUFLLFVBQVUsQ0FBQyxFQUFFO0FBQzFFLFFBQVEsS0FBSyxJQUFJLEdBQUcsSUFBSSxNQUFNLEVBQUU7QUFDaEMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFO0FBQ3JELGdCQUFnQixJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssS0FBSyxFQUFFO0FBQzFELG9CQUFvQixNQUFNO0FBQzFCLGlCQUFpQjtBQUNqQixhQUFhO0FBQ2IsU0FBUztBQUNULEtBQUs7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxPQUFjLEdBQUcsQ0FBQyxZ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
