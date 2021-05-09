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
    // flashcards
    flashcardTags: ["#flashcards"],
    singleLineCommentOnSameLine: false,
    buryRelatedCards: false,
    // notes
    tagsToReview: ["#review"],
    openRandomNote: false,
    autoNextNote: false,
    disableFileMenuReviewOptions: false,
    // algorithm
    baseEase: 250,
    maxLinkFactor: 1.0,
    lapsesIntervalChange: 0.5,
    easyBonus: 1.3,
};
class SRSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createDiv().innerHTML =
            "<h2>Spaced Repetition Plugin - Settings</h2>";
        containerEl.createDiv().innerHTML =
            'For more information, check the <a href="https://github.com/st3v3nmw/obsidian-spaced-repetition/wiki">wiki</a>.';
        containerEl.createDiv().innerHTML = "<h3>Flashcards</h3>";
        new obsidian.Setting(containerEl)
            .setName("Flashcard tags")
            .setDesc("Enter tags separated by spaces i.e. #flashcards #deck2 #deck3.")
            .addTextArea((text) => text
            .setValue(`${this.plugin.data.settings.flashcardTags.join(" ")}`)
            .onChange(async (value) => {
            this.plugin.data.settings.flashcardTags = value.split(" ");
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Save scheduling comment for single-line flashcards on the same line?")
            .setDesc("Turning this on will make the HTML comments not break list formatting")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.singleLineCommentOnSameLine)
            .onChange(async (value) => {
            this.plugin.data.settings.singleLineCommentOnSameLine = value;
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Bury related cards until the next review session?")
            .setDesc("This applies to other cloze deletions in cloze cards")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.buryRelatedCards)
            .onChange(async (value) => {
            this.plugin.data.settings.buryRelatedCards = value;
            await this.plugin.savePluginData();
        }));
        containerEl.createDiv().innerHTML = "<h3>Notes</h3>";
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
            .setDesc("For faster reviews")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.autoNextNote)
            .onChange(async (value) => {
            this.plugin.data.settings.autoNextNote = value;
            await this.plugin.savePluginData();
        }));
        new obsidian.Setting(containerEl)
            .setName("Disable review options in the file menu i.e. Review: Easy Good Hard")
            .setDesc("After disabling, you can review using the command hotkeys. Reload Obsidian after changing this.")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.data.settings.disableFileMenuReviewOptions)
            .onChange(async (value) => {
            this.plugin.data.settings.disableFileMenuReviewOptions = value;
            await this.plugin.savePluginData();
        }));
        containerEl.createDiv().innerHTML = "<h3>Algorithm</h3>";
        containerEl.createDiv().innerHTML =
            'For more information, check the <a href="https://github.com/st3v3nmw/obsidian-spaced-repetition/wiki/Spaced-Repetition-Algorithm">algorithm implementation</a>.';
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
            .setName("Easy bonus")
            .setDesc("The easy bonus allows you to set the difference in intervals between answering Good and Easy on a card (minimum = 100%)")
            .addText((text) => text
            .setValue(`${this.plugin.data.settings.easyBonus * 100}`)
            .onChange(async (value) => {
            let numValue = Number.parseInt(value) / 100;
            if (!isNaN(numValue)) {
                if (numValue < 1.0) {
                    new obsidian.Notice("The easy bonus must be at least 100.");
                    text.setValue(`${this.plugin.data.settings.easyBonus *
                        100}`);
                    return;
                }
                this.plugin.data.settings.easyBonus = numValue;
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
    }
}

var ReviewResponse;
(function (ReviewResponse) {
    ReviewResponse[ReviewResponse["Easy"] = 0] = "Easy";
    ReviewResponse[ReviewResponse["Good"] = 1] = "Good";
    ReviewResponse[ReviewResponse["Hard"] = 2] = "Hard";
    ReviewResponse[ReviewResponse["Reset"] = 3] = "Reset";
})(ReviewResponse || (ReviewResponse = {}));
var CardType;
(function (CardType) {
    CardType[CardType["SingleLineBasic"] = 0] = "SingleLineBasic";
    CardType[CardType["MultiLineBasic"] = 1] = "MultiLineBasic";
    CardType[CardType["Cloze"] = 2] = "Cloze";
})(CardType || (CardType = {}));
var FlashcardModalMode;
(function (FlashcardModalMode) {
    FlashcardModalMode[FlashcardModalMode["DecksList"] = 0] = "DecksList";
    FlashcardModalMode[FlashcardModalMode["Front"] = 1] = "Front";
    FlashcardModalMode[FlashcardModalMode["Back"] = 2] = "Back";
    FlashcardModalMode[FlashcardModalMode["Closed"] = 3] = "Closed";
})(FlashcardModalMode || (FlashcardModalMode = {}));

function schedule(response, interval, ease, lapsesIntervalChange, easyBonus, fuzz = true) {
    if (response != ReviewResponse.Good) {
        ease =
            response == ReviewResponse.Easy
                ? ease + 20
                : Math.max(130, ease - 20);
    }
    if (response == ReviewResponse.Hard)
        interval = Math.max(1, interval * lapsesIntervalChange);
    else
        interval = (interval * ease) / 100;
    if (response == ReviewResponse.Easy)
        interval *= easyBonus;
    if (fuzz) {
        // fuzz
        if (interval >= 8) {
            let fuzz = [-0.05 * interval, 0, 0.05 * interval];
            interval += fuzz[Math.floor(Math.random() * fuzz.length)];
        }
    }
    return { interval: Math.round(interval * 10) / 10, ease };
}

const SCHEDULING_INFO_REGEX = /^---\n((?:.*\n)*)sr-due: (.+)\nsr-interval: (\d+)\nsr-ease: (\d+)\n((?:.*\n)*)---/;
const YAML_FRONT_MATTER_REGEX = /^---\n((?:.*\n)*?)---/;
const SINGLELINE_CARD_REGEX = /^(.+)::(.+?)\n?(?:<!--SR:(.+),(\d+),(\d+)-->|$)/gm;
const MULTILINE_CARD_REGEX = /^((?:.+\n)+)\?\n((?:.+\n)+?)(?:<!--SR:(.+),(\d+),(\d+)-->|$)/gm;
const CLOZE_CARD_DETECTOR = /(?:.+\n)*^.*?==.*?==.*\n(?:.+\n?)*/gm; // card must have at least one cloze
const CLOZE_DELETIONS_EXTRACTOR = /==(.*?)==/gm;
const CLOZE_SCHEDULING_EXTRACTOR = /!([\d-]+),(\d+),(\d+)/gm;
const CROSS_HAIRS_ICON = `<path style=" stroke:none;fill-rule:nonzero;fill:currentColor;fill-opacity:1;" d="M 99.921875 47.941406 L 93.074219 47.941406 C 92.84375 42.03125 91.390625 36.238281 88.800781 30.921875 L 85.367188 32.582031 C 87.667969 37.355469 88.964844 42.550781 89.183594 47.84375 L 82.238281 47.84375 C 82.097656 44.617188 81.589844 41.417969 80.734375 38.304688 L 77.050781 39.335938 C 77.808594 42.089844 78.261719 44.917969 78.40625 47.769531 L 65.871094 47.769531 C 64.914062 40.507812 59.144531 34.832031 51.871094 33.996094 L 51.871094 21.386719 C 54.816406 21.507812 57.742188 21.960938 60.585938 22.738281 L 61.617188 19.058594 C 58.4375 18.191406 55.164062 17.691406 51.871094 17.570312 L 51.871094 10.550781 C 57.164062 10.769531 62.355469 12.066406 67.132812 14.363281 L 68.789062 10.929688 C 63.5 8.382812 57.738281 6.953125 51.871094 6.734375 L 51.871094 0.0390625 L 48.054688 0.0390625 L 48.054688 6.734375 C 42.179688 6.976562 36.417969 8.433594 31.132812 11.007812 L 32.792969 14.441406 C 37.566406 12.140625 42.761719 10.84375 48.054688 10.625 L 48.054688 17.570312 C 44.828125 17.714844 41.628906 18.21875 38.515625 19.078125 L 39.546875 22.757812 C 42.324219 21.988281 45.175781 21.53125 48.054688 21.386719 L 48.054688 34.03125 C 40.796875 34.949219 35.089844 40.679688 34.203125 47.941406 L 21.5 47.941406 C 21.632812 45.042969 22.089844 42.171875 22.855469 39.375 L 19.171875 38.34375 C 18.3125 41.457031 17.808594 44.65625 17.664062 47.882812 L 10.664062 47.882812 C 10.882812 42.589844 12.179688 37.394531 14.480469 32.621094 L 11.121094 30.921875 C 8.535156 36.238281 7.078125 42.03125 6.847656 47.941406 L 0 47.941406 L 0 51.753906 L 6.847656 51.753906 C 7.089844 57.636719 8.542969 63.402344 11.121094 68.695312 L 14.554688 67.035156 C 12.257812 62.261719 10.957031 57.066406 10.738281 51.773438 L 17.742188 51.773438 C 17.855469 55.042969 18.34375 58.289062 19.191406 61.445312 L 22.871094 60.414062 C 22.089844 57.5625 21.628906 54.632812 21.5 51.679688 L 34.203125 51.679688 C 35.058594 58.96875 40.773438 64.738281 48.054688 65.660156 L 48.054688 78.308594 C 45.105469 78.1875 42.183594 77.730469 39.335938 76.957031 L 38.304688 80.636719 C 41.488281 81.511719 44.757812 82.015625 48.054688 82.144531 L 48.054688 89.144531 C 42.761719 88.925781 37.566406 87.628906 32.792969 85.328125 L 31.132812 88.765625 C 36.425781 91.3125 42.183594 92.742188 48.054688 92.960938 L 48.054688 99.960938 L 51.871094 99.960938 L 51.871094 92.960938 C 57.75 92.71875 63.519531 91.265625 68.808594 88.6875 L 67.132812 85.253906 C 62.355469 87.550781 57.164062 88.851562 51.871094 89.070312 L 51.871094 82.125 C 55.09375 81.980469 58.292969 81.476562 61.40625 80.617188 L 60.378906 76.9375 C 57.574219 77.703125 54.695312 78.15625 51.792969 78.289062 L 51.792969 65.679688 C 59.121094 64.828125 64.910156 59.0625 65.796875 51.734375 L 78.367188 51.734375 C 78.25 54.734375 77.789062 57.710938 76.992188 60.605469 L 80.675781 61.636719 C 81.558594 58.40625 82.066406 55.082031 82.183594 51.734375 L 89.261719 51.734375 C 89.042969 57.03125 87.742188 62.222656 85.445312 66.996094 L 88.878906 68.65625 C 91.457031 63.367188 92.910156 57.597656 93.152344 51.71875 L 100 51.71875 Z M 62.019531 51.734375 C 61.183594 56.945312 57.085938 61.023438 51.871094 61.828125 L 51.871094 57.515625 L 48.054688 57.515625 L 48.054688 61.808594 C 42.910156 60.949219 38.886719 56.902344 38.058594 51.753906 L 42.332031 51.753906 L 42.332031 47.941406 L 38.058594 47.941406 C 38.886719 42.789062 42.910156 38.746094 48.054688 37.886719 L 48.054688 42.179688 L 51.871094 42.179688 L 51.871094 37.847656 C 57.078125 38.648438 61.179688 42.71875 62.019531 47.921875 L 57.707031 47.921875 L 57.707031 51.734375 Z M 62.019531 51.734375 "/>`;
const COLLAPSE_ICON = `<svg viewBox="0 0 100 100" width="8" height="8" class="right-triangle"><path fill="currentColor" stroke="currentColor" d="M94.9,20.8c-1.4-2.5-4.1-4.1-7.1-4.1H12.2c-3,0-5.7,1.6-7.1,4.1c-1.3,2.4-1.2,5.2,0.2,7.6L43.1,88c1.5,2.3,4,3.7,6.9,3.7 s5.4-1.4,6.9-3.7l37.8-59.6C96.1,26,96.2,23.2,94.9,20.8L94.9,20.8z"></path></svg>`;

class FlashcardModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.titleEl.setText("Decks");
        if (obsidian.Platform.isMobile) {
            this.modalEl.style.height = "100%";
            this.modalEl.style.width = "100%";
            this.contentEl.style.display = "block";
        }
        else {
            this.modalEl.style.height = "80%";
            this.modalEl.style.width = "40%";
        }
        this.contentEl.style.position = "relative";
        this.contentEl.style.height = "92%";
        this.contentEl.addClass("sr-modal-content");
        document.body.onkeypress = (e) => {
            if (this.mode != FlashcardModalMode.DecksList) {
                if (this.mode != FlashcardModalMode.Closed &&
                    e.code == "KeyS") {
                    if (this.currentCard.isDue)
                        this.plugin.dueFlashcards[this.currentDeck].splice(0, 1);
                    else
                        this.plugin.newFlashcards[this.currentDeck].splice(0, 1);
                    if (this.currentCard.cardType == CardType.Cloze)
                        this.buryRelatedCards(this.currentCard.relatedCards);
                    this.nextCard();
                }
                else if (this.mode == FlashcardModalMode.Front &&
                    (e.code == "Space" || e.code == "Enter"))
                    this.showAnswer();
                else if (this.mode == FlashcardModalMode.Back) {
                    if (e.code == "Numpad1" || e.code == "Digit1")
                        this.processReview(ReviewResponse.Hard);
                    else if (e.code == "Numpad2" || e.code == "Digit2")
                        this.processReview(ReviewResponse.Good);
                    else if (e.code == "Numpad3" || e.code == "Digit3")
                        this.processReview(ReviewResponse.Easy);
                    else if (e.code == "Numpad0" || e.code == "Digit0")
                        this.processReview(ReviewResponse.Reset);
                }
            }
        };
    }
    onOpen() {
        this.decksList();
    }
    onClose() {
        this.mode = FlashcardModalMode.Closed;
    }
    decksList() {
        this.mode = FlashcardModalMode.DecksList;
        this.titleEl.setText("Decks");
        this.contentEl.innerHTML = "";
        let colHeading = this.contentEl.createDiv("sr-deck");
        colHeading.innerHTML =
            "<i></i><span style='text-align:right;'>Due</span>" +
                "<span style='text-align:right;'>New</span>";
        for (let deckName in this.plugin.dueFlashcards) {
            let deckView = this.contentEl.createDiv("sr-deck");
            deckView.setText(deckName);
            deckView.innerHTML +=
                `<span style="color:#4caf50;text-align:right;">${this.plugin.dueFlashcards[deckName].length}</span>` +
                    `<span style="color:#2196f3;text-align:right;">${this.plugin.newFlashcards[deckName].length}</span>`;
            deckView.addEventListener("click", (_) => {
                this.currentDeck = deckName;
                this.setupCardsView();
                this.nextCard();
            });
        }
    }
    setupCardsView() {
        this.contentEl.innerHTML = "";
        this.fileLinkView = createDiv("sr-link");
        this.fileLinkView.setText("Open file");
        this.fileLinkView.addEventListener("click", (_) => {
            this.close();
            this.plugin.app.workspace.activeLeaf.openFile(this.currentCard.note);
        });
        this.contentEl.appendChild(this.fileLinkView);
        this.resetLinkView = createDiv("sr-link");
        this.resetLinkView.setText("Reset card's progress");
        this.resetLinkView.addEventListener("click", (_) => {
            this.processReview(ReviewResponse.Reset);
        });
        this.resetLinkView.style.float = "right";
        this.contentEl.appendChild(this.resetLinkView);
        this.contextView = document.createElement("div");
        this.contextView.setAttribute("id", "sr-context");
        this.contentEl.appendChild(this.contextView);
        this.flashcardView = document.createElement("div");
        this.flashcardView.setAttribute("id", "sr-flashcard-view");
        this.contentEl.appendChild(this.flashcardView);
        this.responseDiv = createDiv("sr-response");
        this.hardBtn = document.createElement("button");
        this.hardBtn.setAttribute("id", "sr-hard-btn");
        this.hardBtn.setText("Hard");
        this.hardBtn.addEventListener("click", (_) => {
            this.processReview(ReviewResponse.Hard);
        });
        this.responseDiv.appendChild(this.hardBtn);
        this.goodBtn = document.createElement("button");
        this.goodBtn.setAttribute("id", "sr-good-btn");
        this.goodBtn.setText("Good");
        this.goodBtn.addEventListener("click", (_) => {
            this.processReview(ReviewResponse.Good);
        });
        this.responseDiv.appendChild(this.goodBtn);
        this.easyBtn = document.createElement("button");
        this.easyBtn.setAttribute("id", "sr-easy-btn");
        this.easyBtn.setText("Easy");
        this.easyBtn.addEventListener("click", (_) => {
            this.processReview(ReviewResponse.Easy);
        });
        this.responseDiv.appendChild(this.easyBtn);
        this.responseDiv.style.display = "none";
        this.contentEl.appendChild(this.responseDiv);
        this.answerBtn = document.createElement("div");
        this.answerBtn.setAttribute("id", "sr-show-answer");
        this.answerBtn.setText("Show Answer");
        this.answerBtn.addEventListener("click", (_) => {
            this.showAnswer();
        });
        this.contentEl.appendChild(this.answerBtn);
    }
    nextCard() {
        this.responseDiv.style.display = "none";
        this.resetLinkView.style.display = "none";
        let count = this.plugin.newFlashcards[this.currentDeck].length +
            this.plugin.dueFlashcards[this.currentDeck].length;
        this.titleEl.setText(`${this.currentDeck} - ${count}`);
        if (count == 0) {
            this.decksList();
            return;
        }
        this.answerBtn.style.display = "initial";
        this.flashcardView.innerHTML = "";
        this.mode = FlashcardModalMode.Front;
        if (this.plugin.dueFlashcards[this.currentDeck].length > 0) {
            this.currentCard = this.plugin.dueFlashcards[this.currentDeck][0];
            obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.front, this.flashcardView, this.currentCard.note.path, null);
            let hardInterval = schedule(ReviewResponse.Hard, this.currentCard.interval, this.currentCard.ease, this.plugin.data.settings.lapsesIntervalChange, this.plugin.data.settings.easyBonus, false).interval;
            let goodInterval = schedule(ReviewResponse.Good, this.currentCard.interval, this.currentCard.ease, this.plugin.data.settings.lapsesIntervalChange, this.plugin.data.settings.easyBonus, false).interval;
            let easyInterval = schedule(ReviewResponse.Easy, this.currentCard.interval, this.currentCard.ease, this.plugin.data.settings.lapsesIntervalChange, this.plugin.data.settings.easyBonus, false).interval;
            if (obsidian.Platform.isMobile) {
                this.hardBtn.setText(`${hardInterval}d`);
                this.goodBtn.setText(`${goodInterval}d`);
                this.easyBtn.setText(`${easyInterval}d`);
            }
            else {
                this.hardBtn.setText(`Hard - ${hardInterval} day(s)`);
                this.goodBtn.setText(`Good - ${goodInterval} day(s)`);
                this.easyBtn.setText(`Easy - ${easyInterval} day(s)`);
            }
        }
        else if (this.plugin.newFlashcards[this.currentDeck].length > 0) {
            this.currentCard = this.plugin.newFlashcards[this.currentDeck][0];
            obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.front, this.flashcardView, this.currentCard.note.path, null);
            if (obsidian.Platform.isMobile) {
                this.hardBtn.setText("1.0d");
                this.goodBtn.setText("2.5d");
                this.easyBtn.setText("3.5d");
            }
            else {
                this.hardBtn.setText("Hard - 1.0 day(s)");
                this.goodBtn.setText("Good - 2.5 day(s)");
                this.easyBtn.setText("Easy - 3.5 day(s)");
            }
        }
        this.contextView.setText(this.currentCard.context);
    }
    showAnswer() {
        this.mode = FlashcardModalMode.Back;
        this.answerBtn.style.display = "none";
        this.responseDiv.style.display = "grid";
        if (this.currentCard.isDue)
            this.resetLinkView.style.display = "inline-block";
        if (this.currentCard.cardType != CardType.Cloze) {
            let hr = document.createElement("hr");
            hr.setAttribute("id", "sr-hr-card-divide");
            this.flashcardView.appendChild(hr);
        }
        else
            this.flashcardView.innerHTML = "";
        obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.back, this.flashcardView, this.currentCard.note.path, null);
    }
    async processReview(response) {
        let interval, ease, due;
        if (response != ReviewResponse.Reset) {
            // scheduled card
            if (this.currentCard.isDue) {
                this.plugin.dueFlashcards[this.currentDeck].splice(0, 1);
                let schedObj = schedule(response, this.currentCard.interval, this.currentCard.ease, this.plugin.data.settings.lapsesIntervalChange, this.plugin.data.settings.easyBonus);
                interval = Math.round(schedObj.interval);
                ease = schedObj.ease;
            }
            else {
                let schedObj = schedule(response, 1, this.plugin.data.settings.baseEase, this.plugin.data.settings.lapsesIntervalChange, this.plugin.data.settings.easyBonus);
                this.plugin.newFlashcards[this.currentDeck].splice(0, 1);
                interval = Math.round(schedObj.interval);
                ease = schedObj.ease;
            }
            due = window.moment(Date.now() + interval * 24 * 3600 * 1000);
        }
        else {
            interval = 1.0;
            ease = this.plugin.data.settings.baseEase;
            this.plugin.dueFlashcards[this.currentDeck].splice(0, 1);
            this.plugin.dueFlashcards[this.currentDeck].push(this.currentCard);
            due = window.moment(Date.now());
            new obsidian.Notice("Card's progress has been reset");
        }
        let dueString = due.format("YYYY-MM-DD");
        let fileText = await this.app.vault.read(this.currentCard.note);
        let replacementRegex = new RegExp(this.currentCard.cardText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), // escape string
        "gm");
        if (this.currentCard.cardType == CardType.Cloze) {
            let schedIdx = this.currentCard.cardText.lastIndexOf("<!--SR:");
            if (schedIdx == -1) {
                // first time adding scheduling information to flashcard
                this.currentCard.cardText = `${this.currentCard.cardText}\n<!--SR:!${dueString},${interval},${ease}-->`;
            }
            else {
                let scheduling = [
                    ...this.currentCard.cardText.matchAll(CLOZE_SCHEDULING_EXTRACTOR),
                ];
                let deletionSched = ["0", dueString, `${interval}`, `${ease}`];
                if (this.currentCard.isDue)
                    scheduling[this.currentCard.subCardIdx] = deletionSched;
                else
                    scheduling.push(deletionSched);
                this.currentCard.cardText = this.currentCard.cardText.replace(/<!--SR:.+-->/gm, "");
                this.currentCard.cardText += "<!--SR:";
                for (let i = 0; i < scheduling.length; i++)
                    this.currentCard.cardText += `!${scheduling[i][1]},${scheduling[i][2]},${scheduling[i][3]}`;
                this.currentCard.cardText += "-->";
            }
            fileText = fileText.replace(replacementRegex, this.currentCard.cardText);
            for (let relatedCard of this.currentCard.relatedCards)
                relatedCard.cardText = this.currentCard.cardText;
            if (this.plugin.data.settings.buryRelatedCards)
                this.buryRelatedCards(this.currentCard.relatedCards);
        }
        else {
            if (this.currentCard.cardType == CardType.SingleLineBasic) {
                let sep = this.plugin.data.settings.singleLineCommentOnSameLine
                    ? " "
                    : "\n";
                fileText = fileText.replace(replacementRegex, `${this.currentCard.front}::${this.currentCard.back}${sep}<!--SR:${dueString},${interval},${ease}-->`);
            }
            else {
                fileText = fileText.replace(replacementRegex, `${this.currentCard.front}\n?\n${this.currentCard.back}\n<!--SR:${dueString},${interval},${ease}-->`);
            }
        }
        await this.app.vault.modify(this.currentCard.note, fileText);
        this.nextCard();
    }
    buryRelatedCards(arr) {
        for (let relatedCard of arr) {
            let dueIdx = this.plugin.dueFlashcards[this.currentDeck].indexOf(relatedCard);
            let newIdx = this.plugin.newFlashcards[this.currentDeck].indexOf(relatedCard);
            if (dueIdx != -1)
                this.plugin.dueFlashcards[this.currentDeck].splice(dueIdx, 1);
            else if (newIdx != -1)
                this.plugin.newFlashcards[this.currentDeck].splice(newIdx, 1);
        }
    }
}

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
class SRPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.newNotes = [];
        this.scheduledNotes = [];
        this.easeByPath = {};
        this.incomingLinks = {};
        this.pageranks = {};
        this.dueNotesCount = 0;
        this.newFlashcards = {}; // <deck name, Card[]>
        this.newFlashcardsCount = 0;
        this.dueFlashcards = {}; // <deck name, Card[]>
        this.dueFlashcardsCount = 0;
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
        if (!this.data.settings.disableFileMenuReviewOptions) {
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
        }
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
            setTimeout(() => this.flashcards_sync(), 2000);
        });
    }
    onunload() {
        this.app.workspace
            .getLeavesOfType(REVIEW_QUEUE_VIEW_TYPE)
            .forEach((leaf) => leaf.detach());
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
            let tags = obsidian.getAllTags(fileCachedData) || [];
            let shouldIgnore = true;
            for (let tag of tags) {
                if (this.data.settings.tagsToReview.includes(tag)) {
                    shouldIgnore = false;
                    break;
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
            let dueUnix = window
                .moment(frontmatter["sr-due"], [
                "YYYY-MM-DD",
                "DD-MM-YYYY",
                "ddd MMM DD YYYY",
            ])
                .valueOf();
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
        this.statusBar.setText(`Review: ${this.dueNotesCount} note(s), ${this.dueFlashcardsCount} card(s) due`);
        this.reviewQueueView.redraw();
    }
    async saveReviewResponse(note, response) {
        let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
        let frontmatter = fileCachedData.frontmatter || {};
        let tags = obsidian.getAllTags(fileCachedData) || [];
        let shouldIgnore = true;
        for (let tag of tags) {
            if (this.data.settings.tagsToReview.includes(tag)) {
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
        let schedObj = schedule(response, interval, ease, this.data.settings.lapsesIntervalChange, this.data.settings.easyBonus);
        interval = Math.round(schedObj.interval);
        ease = schedObj.ease;
        let due = window.moment(Date.now() + interval * 24 * 3600 * 1000);
        let dueString = due.format("YYYY-MM-DD");
        // check if scheduling info exists
        if (SCHEDULING_INFO_REGEX.test(fileText)) {
            let schedulingInfo = SCHEDULING_INFO_REGEX.exec(fileText);
            fileText = fileText.replace(SCHEDULING_INFO_REGEX, `---\n${schedulingInfo[1]}sr-due: ${dueString}\nsr-interval: ${interval}\nsr-ease: ${ease}\n${schedulingInfo[5]}---`);
            // new note with existing YAML front matter
        }
        else if (YAML_FRONT_MATTER_REGEX.test(fileText)) {
            let existingYaml = YAML_FRONT_MATTER_REGEX.exec(fileText);
            fileText = fileText.replace(YAML_FRONT_MATTER_REGEX, `---\n${existingYaml[1]}sr-due: ${dueString}\nsr-interval: ${interval}\nsr-ease: ${ease}\n---`);
        }
        else {
            fileText = `---\nsr-due: ${dueString}\nsr-interval: ${interval}\nsr-ease: ${ease}\n---\n\n${fileText}`;
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
        this.newFlashcards = {};
        this.newFlashcardsCount = 0;
        this.dueFlashcards = {};
        this.dueFlashcardsCount = 0;
        for (let note of notes) {
            let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
            fileCachedData.frontmatter || {};
            let tags = obsidian.getAllTags(fileCachedData) || [];
            for (let tag of tags) {
                if (this.data.settings.flashcardTags.includes(tag)) {
                    await this.findFlashcards(note, tag);
                    break;
                }
            }
        }
        // sort the deck names
        this.dueFlashcards = Object.keys(this.dueFlashcards)
            .sort()
            .reduce((obj, key) => {
            obj[key] = this.dueFlashcards[key];
            return obj;
        }, {});
        this.newFlashcards = Object.keys(this.newFlashcards)
            .sort()
            .reduce((obj, key) => {
            obj[key] = this.newFlashcards[key];
            return obj;
        }, {});
        this.statusBar.setText(`Review: ${this.dueNotesCount} note(s), ${this.dueFlashcardsCount} card(s) due`);
    }
    async findFlashcards(note, deck) {
        let fileText = await this.app.vault.read(note);
        let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
        let headings = fileCachedData.headings || [];
        let fileChanged = false;
        if (!this.dueFlashcards.hasOwnProperty(deck)) {
            this.dueFlashcards[deck] = [];
            this.newFlashcards[deck] = [];
        }
        let now = Date.now();
        // basic cards
        for (let regex of [SINGLELINE_CARD_REGEX, MULTILINE_CARD_REGEX]) {
            let cardType = regex == SINGLELINE_CARD_REGEX
                ? CardType.SingleLineBasic
                : CardType.MultiLineBasic;
            for (let match of fileText.matchAll(regex)) {
                match[0] = match[0].trim();
                match[1] = match[1].trim();
                match[2] = match[2].trim();
                let cardObj;
                // flashcard already scheduled
                if (match[3]) {
                    let dueUnix = window
                        .moment(match[3], ["YYYY-MM-DD", "DD-MM-YYYY", "ddd MMM DD YYYY"])
                        .valueOf();
                    if (dueUnix <= now) {
                        cardObj = {
                            isDue: true,
                            interval: parseInt(match[4]),
                            ease: parseInt(match[5]),
                            note,
                            front: match[1],
                            back: match[2],
                            cardText: match[0],
                            context: "",
                            cardType,
                        };
                        this.dueFlashcards[deck].push(cardObj);
                        this.dueFlashcardsCount++;
                    }
                    else
                        continue;
                }
                else {
                    cardObj = {
                        isDue: false,
                        note,
                        front: match[1],
                        back: match[2],
                        cardText: match[0],
                        context: "",
                        cardType,
                    };
                    this.newFlashcards[deck].push(cardObj);
                    this.newFlashcardsCount++;
                }
                addContextToCard(cardObj, match.index, headings);
            }
        }
        // cloze deletion cards
        for (let match of fileText.matchAll(CLOZE_CARD_DETECTOR)) {
            match[0] = match[0].trim();
            let cardText = match[0];
            let deletions = [...cardText.matchAll(CLOZE_DELETIONS_EXTRACTOR)];
            let scheduling = [...cardText.matchAll(CLOZE_SCHEDULING_EXTRACTOR)];
            // we have some extra scheduling dates to delete
            if (scheduling.length > deletions.length) {
                let idxSched = cardText.lastIndexOf("<!--SR:") + 7;
                let newCardText = cardText.substring(0, idxSched);
                for (let i = 0; i < deletions.length; i++)
                    newCardText += `!${scheduling[i][1]},${scheduling[i][2]},${scheduling[i][3]}`;
                newCardText += "-->\n";
                let replacementRegex = new RegExp(cardText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), // escape string
                "gm");
                fileText = fileText.replace(replacementRegex, newCardText);
                fileChanged = true;
            }
            let relatedCards = [];
            for (let i = 0; i < deletions.length; i++) {
                let cardObj;
                let deletionStart = deletions[i].index;
                let deletionEnd = deletionStart + deletions[i][0].length;
                let front = cardText.substring(0, deletionStart) +
                    "<span style='color:#2196f3'>[...]</span>" +
                    cardText.substring(deletionEnd);
                front = front.replace(/==/gm, "");
                let back = cardText.substring(0, deletionStart) +
                    "<span style='color:#2196f3'>" +
                    cardText.substring(deletionStart, deletionEnd) +
                    "</span>" +
                    cardText.substring(deletionEnd);
                back = back.replace(/==/gm, "");
                // card deletion scheduled
                if (i < scheduling.length) {
                    let dueUnix = window
                        .moment(scheduling[i][1], ["YYYY-MM-DD", "DD-MM-YYYY"])
                        .valueOf();
                    if (dueUnix <= now) {
                        cardObj = {
                            isDue: true,
                            interval: parseInt(scheduling[i][2]),
                            ease: parseInt(scheduling[i][3]),
                            note,
                            front,
                            back,
                            cardText: match[0],
                            context: "",
                            cardType: CardType.Cloze,
                            subCardIdx: i,
                            relatedCards,
                        };
                        this.dueFlashcards[deck].push(cardObj);
                        this.dueFlashcardsCount++;
                    }
                    else
                        continue;
                }
                else {
                    // new card
                    cardObj = {
                        isDue: false,
                        note,
                        front,
                        back,
                        cardText: match[0],
                        context: "",
                        cardType: CardType.Cloze,
                        subCardIdx: i,
                        relatedCards,
                    };
                    this.newFlashcards[deck].push(cardObj);
                    this.newFlashcardsCount++;
                }
                relatedCards.push(cardObj);
                addContextToCard(cardObj, match.index, headings);
            }
        }
        if (fileChanged)
            await this.app.vault.modify(note, fileText);
    }
    async loadPluginData() {
        this.data = Object.assign({}, DEFAULT_DATA, await this.loadData());
        // misbehaving settings
        // after changes to flashcardTags, save the setting the user already has
        // remove in future (Say, 15th June 2021)
        if (this.data.settings.flashcardTags == undefined) {
            this.data.settings.flashcardTags = [
                //@ts-ignore
                this.data.settings.flashcardsTag,
            ];
            await this.savePluginData();
        }
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
function addContextToCard(cardObj, cardOffset, headings) {
    let stack = [];
    for (let heading of headings) {
        if (heading.position.start.offset > cardOffset)
            break;
        while (stack.length > 0 &&
            stack[stack.length - 1].level >= heading.level)
            stack.pop();
        stack.push(heading);
    }
    for (let headingObj of stack)
        cardObj.context += headingObj.heading + " > ";
    cardObj.context = cardObj.context.slice(0, -3);
}

module.exports = SRPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3BhZ2VyYW5rLmpzL2xpYi9pbmRleC5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy90eXBlcy50cyIsInNyYy9zY2hlZC50cyIsInNyYy9jb25zdGFudHMudHMiLCJzcmMvZmxhc2hjYXJkLW1vZGFsLnRzIiwic3JjL3NpZGViYXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZvck93bihvYmplY3QsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCh0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JykgJiYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKG9iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGtleSwgb2JqZWN0W2tleV0pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHtcbiAgICAgICAgY291bnQ6IDAsXG4gICAgICAgIGVkZ2VzOiB7fSxcbiAgICAgICAgbm9kZXM6IHt9XG4gICAgfTtcblxuICAgIHNlbGYubGluayA9IGZ1bmN0aW9uIChzb3VyY2UsIHRhcmdldCwgd2VpZ2h0KSB7XG4gICAgICAgIGlmICgoaXNGaW5pdGUod2VpZ2h0KSAhPT0gdHJ1ZSkgfHwgKHdlaWdodCA9PT0gbnVsbCkpIHtcbiAgICAgICAgICAgIHdlaWdodCA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdlaWdodCA9IHBhcnNlRmxvYXQod2VpZ2h0KTtcblxuICAgICAgICBpZiAoc2VsZi5ub2Rlcy5oYXNPd25Qcm9wZXJ0eShzb3VyY2UpICE9PSB0cnVlKSB7XG4gICAgICAgICAgICBzZWxmLmNvdW50Kys7XG4gICAgICAgICAgICBzZWxmLm5vZGVzW3NvdXJjZV0gPSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0OiAwLFxuICAgICAgICAgICAgICAgIG91dGJvdW5kOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kICs9IHdlaWdodDtcblxuICAgICAgICBpZiAoc2VsZi5ub2Rlcy5oYXNPd25Qcm9wZXJ0eSh0YXJnZXQpICE9PSB0cnVlKSB7XG4gICAgICAgICAgICBzZWxmLmNvdW50Kys7XG4gICAgICAgICAgICBzZWxmLm5vZGVzW3RhcmdldF0gPSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0OiAwLFxuICAgICAgICAgICAgICAgIG91dGJvdW5kOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNlbGYuZWRnZXMuaGFzT3duUHJvcGVydHkoc291cmNlKSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgc2VsZi5lZGdlc1tzb3VyY2VdID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsZi5lZGdlc1tzb3VyY2VdLmhhc093blByb3BlcnR5KHRhcmdldCkgIT09IHRydWUpIHtcbiAgICAgICAgICAgIHNlbGYuZWRnZXNbc291cmNlXVt0YXJnZXRdID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuZWRnZXNbc291cmNlXVt0YXJnZXRdICs9IHdlaWdodDtcbiAgICB9O1xuXG4gICAgc2VsZi5yYW5rID0gZnVuY3Rpb24gKGFscGhhLCBlcHNpbG9uLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVsdGEgPSAxLFxuICAgICAgICAgICAgaW52ZXJzZSA9IDEgLyBzZWxmLmNvdW50O1xuXG4gICAgICAgIGZvck93bihzZWxmLmVkZ2VzLCBmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kID4gMCkge1xuICAgICAgICAgICAgICAgIGZvck93bihzZWxmLmVkZ2VzW3NvdXJjZV0sIGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lZGdlc1tzb3VyY2VdW3RhcmdldF0gLz0gc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgc2VsZi5ub2Rlc1trZXldLndlaWdodCA9IGludmVyc2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdoaWxlIChkZWx0YSA+IGVwc2lsb24pIHtcbiAgICAgICAgICAgIHZhciBsZWFrID0gMCxcbiAgICAgICAgICAgICAgICBub2RlcyA9IHt9O1xuXG4gICAgICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBub2Rlc1trZXldID0gdmFsdWUud2VpZ2h0O1xuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlLm91dGJvdW5kID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxlYWsgKz0gdmFsdWUud2VpZ2h0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYubm9kZXNba2V5XS53ZWlnaHQgPSAwO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxlYWsgKj0gYWxwaGE7XG5cbiAgICAgICAgICAgIGZvck93bihzZWxmLm5vZGVzLCBmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgICAgICAgICAgZm9yT3duKHNlbGYuZWRnZXNbc291cmNlXSwgZnVuY3Rpb24gKHRhcmdldCwgd2VpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYubm9kZXNbdGFyZ2V0XS53ZWlnaHQgKz0gYWxwaGEgKiBub2Rlc1tzb3VyY2VdICogd2VpZ2h0O1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5ub2Rlc1tzb3VyY2VdLndlaWdodCArPSAoMSAtIGFscGhhKSAqIGludmVyc2UgKyBsZWFrICogaW52ZXJzZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWx0YSA9IDA7XG5cbiAgICAgICAgICAgIGZvck93bihzZWxmLm5vZGVzLCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGRlbHRhICs9IE1hdGguYWJzKHZhbHVlLndlaWdodCAtIG5vZGVzW2tleV0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGtleSwgc2VsZi5ub2Rlc1trZXldLndlaWdodCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNvdW50ID0gMDtcbiAgICAgICAgc2VsZi5lZGdlcyA9IHt9O1xuICAgICAgICBzZWxmLm5vZGVzID0ge307XG4gICAgfTtcblxuICAgIHJldHVybiBzZWxmO1xufSkoKTtcbiIsImltcG9ydCB7IE5vdGljZSwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBTUlBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgeyBTUlNldHRpbmdzIH0gZnJvbSBcIi4vdHlwZXNcIjtcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFNSU2V0dGluZ3MgPSB7XG4gICAgLy8gZmxhc2hjYXJkc1xuICAgIGZsYXNoY2FyZFRhZ3M6IFtcIiNmbGFzaGNhcmRzXCJdLFxuICAgIHNpbmdsZUxpbmVDb21tZW50T25TYW1lTGluZTogZmFsc2UsXG4gICAgYnVyeVJlbGF0ZWRDYXJkczogZmFsc2UsXG4gICAgLy8gbm90ZXNcbiAgICB0YWdzVG9SZXZpZXc6IFtcIiNyZXZpZXdcIl0sXG4gICAgb3BlblJhbmRvbU5vdGU6IGZhbHNlLFxuICAgIGF1dG9OZXh0Tm90ZTogZmFsc2UsXG4gICAgZGlzYWJsZUZpbGVNZW51UmV2aWV3T3B0aW9uczogZmFsc2UsXG4gICAgLy8gYWxnb3JpdGhtXG4gICAgYmFzZUVhc2U6IDI1MCxcbiAgICBtYXhMaW5rRmFjdG9yOiAxLjAsXG4gICAgbGFwc2VzSW50ZXJ2YWxDaGFuZ2U6IDAuNSxcbiAgICBlYXN5Qm9udXM6IDEuMyxcbn07XG5cbmV4cG9ydCBjbGFzcyBTUlNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgICBwcml2YXRlIHBsdWdpbjogU1JQbHVnaW47XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBTUlBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIH1cblxuICAgIGRpc3BsYXkoKSB7XG4gICAgICAgIGxldCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KCkuaW5uZXJIVE1MID1cbiAgICAgICAgICAgIFwiPGgyPlNwYWNlZCBSZXBldGl0aW9uIFBsdWdpbiAtIFNldHRpbmdzPC9oMj5cIjtcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVEaXYoKS5pbm5lckhUTUwgPVxuICAgICAgICAgICAgJ0ZvciBtb3JlIGluZm9ybWF0aW9uLCBjaGVjayB0aGUgPGEgaHJlZj1cImh0dHBzOi8vZ2l0aHViLmNvbS9zdDN2M25tdy9vYnNpZGlhbi1zcGFjZWQtcmVwZXRpdGlvbi93aWtpXCI+d2lraTwvYT4uJztcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVEaXYoKS5pbm5lckhUTUwgPSBcIjxoMz5GbGFzaGNhcmRzPC9oMz5cIjtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKFwiRmxhc2hjYXJkIHRhZ3NcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIFwiRW50ZXIgdGFncyBzZXBhcmF0ZWQgYnkgc3BhY2VzIGkuZS4gI2ZsYXNoY2FyZHMgI2RlY2syICNkZWNrMy5cIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRleHRBcmVhKCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5mbGFzaGNhcmRUYWdzLmpvaW4oXCIgXCIpfWBcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmZsYXNoY2FyZFRhZ3MgPSB2YWx1ZS5zcGxpdChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXG4gICAgICAgICAgICAgICAgXCJTYXZlIHNjaGVkdWxpbmcgY29tbWVudCBmb3Igc2luZ2xlLWxpbmUgZmxhc2hjYXJkcyBvbiB0aGUgc2FtZSBsaW5lP1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIlR1cm5pbmcgdGhpcyBvbiB3aWxsIG1ha2UgdGhlIEhUTUwgY29tbWVudHMgbm90IGJyZWFrIGxpc3QgZm9ybWF0dGluZ1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgICAgIC5zZXRWYWx1ZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3Muc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5zaW5nbGVMaW5lQ29tbWVudE9uU2FtZUxpbmUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJCdXJ5IHJlbGF0ZWQgY2FyZHMgdW50aWwgdGhlIG5leHQgcmV2aWV3IHNlc3Npb24/XCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIlRoaXMgYXBwbGllcyB0byBvdGhlciBjbG96ZSBkZWxldGlvbnMgaW4gY2xvemUgY2FyZHNcIilcbiAgICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgICAgICB0b2dnbGVcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYnVyeVJlbGF0ZWRDYXJkcylcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5idXJ5UmVsYXRlZENhcmRzID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVEaXYoKS5pbm5lckhUTUwgPSBcIjxoMz5Ob3RlczwvaDM+XCI7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIlRhZ3MgdG8gcmV2aWV3XCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIkVudGVyIHRhZ3Mgc2VwYXJhdGVkIGJ5IHNwYWNlcyBpLmUuICNyZXZpZXcgI3RhZzIgI3RhZzMuXCIpXG4gICAgICAgICAgICAuYWRkVGV4dEFyZWEoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5qb2luKFwiIFwiKX1gXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy50YWdzVG9SZXZpZXcgPSB2YWx1ZS5zcGxpdChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJPcGVuIGEgcmFuZG9tIG5vdGUgZm9yIHJldmlld1wiKVxuICAgICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICAgICAgXCJXaGVuIHlvdSB0dXJuIHRoaXMgb2ZmLCBub3RlcyBhcmUgb3JkZXJlZCBieSBpbXBvcnRhbmNlIChQYWdlUmFuaylcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5vcGVuUmFuZG9tTm90ZSlcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5vcGVuUmFuZG9tTm90ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpbkRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIk9wZW4gbmV4dCBub3RlIGF1dG9tYXRpY2FsbHkgYWZ0ZXIgYSByZXZpZXdcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFwiRm9yIGZhc3RlciByZXZpZXdzXCIpXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmF1dG9OZXh0Tm90ZSlcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5hdXRvTmV4dE5vdGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXG4gICAgICAgICAgICAgICAgXCJEaXNhYmxlIHJldmlldyBvcHRpb25zIGluIHRoZSBmaWxlIG1lbnUgaS5lLiBSZXZpZXc6IEVhc3kgR29vZCBIYXJkXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIFwiQWZ0ZXIgZGlzYWJsaW5nLCB5b3UgY2FuIHJldmlldyB1c2luZyB0aGUgY29tbWFuZCBob3RrZXlzLiBSZWxvYWQgT2JzaWRpYW4gYWZ0ZXIgY2hhbmdpbmcgdGhpcy5cIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmRpc2FibGVGaWxlTWVudVJldmlld09wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmRpc2FibGVGaWxlTWVudVJldmlld09wdGlvbnMgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZURpdigpLmlubmVySFRNTCA9IFwiPGgzPkFsZ29yaXRobTwvaDM+XCI7XG5cbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KCkuaW5uZXJIVE1MID1cbiAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgY2hlY2sgdGhlIDxhIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vc3QzdjNubXcvb2JzaWRpYW4tc3BhY2VkLXJlcGV0aXRpb24vd2lraS9TcGFjZWQtUmVwZXRpdGlvbi1BbGdvcml0aG1cIj5hbGdvcml0aG0gaW1wbGVtZW50YXRpb248L2E+Lic7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkJhc2UgZWFzZVwiKVxuICAgICAgICAgICAgLnNldERlc2MoXCJtaW5pbXVtID0gMTMwLCBwcmVmZXJyYWJseSBhcHByb3hpbWF0ZWx5IDI1MFwiKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5iYXNlRWFzZX1gKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVmFsdWU6IG51bWJlciA9IE51bWJlci5wYXJzZUludCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChudW1WYWx1ZSA8IDEzMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJUaGUgYmFzZSBlYXNlIG11c3QgYmUgYXQgbGVhc3QgMTMwLlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJhc2VFYXNlfWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2UgPSBudW1WYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBudW1iZXIuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKFwiSW50ZXJ2YWwgY2hhbmdlIHdoZW4geW91IHJldmlldyBhIG5vdGUvY29uY2VwdCBhcyBoYXJkXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIm5ld0ludGVydmFsID0gb2xkSW50ZXJ2YWwgKiBpbnRlcnZhbENoYW5nZSAvIDEwMCwgMCUgPCBpbnRlcnZhbENoYW5nZSA8IDEwMCVcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlICogMTAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBudW1WYWx1ZTogbnVtYmVyID0gTnVtYmVyLnBhcnNlSW50KHZhbHVlKSAvIDEwMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4obnVtVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG51bVZhbHVlIDwgMC4wMSB8fCBudW1WYWx1ZSA+IDAuOTkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGxvYWQgYmFsYW5jaW5nIHRocmVzaG9sZCBtdXN0IGJlIGluIHRoZSByYW5nZSAwJSA8IGludGVydmFsQ2hhbmdlIDwgMTAwJS5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubGFwc2VzSW50ZXJ2YWxDaGFuZ2UgKiAxMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlID0gbnVtVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpbkRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgbnVtYmVyLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkVhc3kgYm9udXNcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIFwiVGhlIGVhc3kgYm9udXMgYWxsb3dzIHlvdSB0byBzZXQgdGhlIGRpZmZlcmVuY2UgaW4gaW50ZXJ2YWxzIGJldHdlZW4gYW5zd2VyaW5nIEdvb2QgYW5kIEVhc3kgb24gYSBjYXJkIChtaW5pbXVtID0gMTAwJSlcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5lYXN5Qm9udXMgKiAxMDB9YClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG51bVZhbHVlOiBudW1iZXIgPSBOdW1iZXIucGFyc2VJbnQodmFsdWUpIC8gMTAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihudW1WYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobnVtVmFsdWUgPCAxLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGVhc3kgYm9udXMgbXVzdCBiZSBhdCBsZWFzdCAxMDAuXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuZWFzeUJvbnVzICpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmVhc3lCb251cyA9IG51bVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIG51bWJlci5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJNYXhpbXVtIGxpbmsgY29udHJpYnV0aW9uXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIk1heC4gY29udHJpYnV0aW9uIG9mIHRoZSB3ZWlnaHRlZCBlYXNlIG9mIGxpbmtlZCBub3RlcyB0byB0aGUgaW5pdGlhbCBlYXNlICgwJSA8PSBtYXhMaW5rRmFjdG9yIDw9IDEwMCUpXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5tYXhMaW5rRmFjdG9yICogMTAwfWBcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVmFsdWU6IG51bWJlciA9IE51bWJlci5wYXJzZUludCh2YWx1ZSkgLyAxMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChudW1WYWx1ZSA8IDAgfHwgbnVtVmFsdWUgPiAxLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGxpbmsgZmFjdG9yIG11c3QgYmUgaW4gdGhlIHJhbmdlIDAlIDw9IG1heExpbmtGYWN0b3IgPD0gMTAwJS5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWF4TGlua0ZhY3RvciAqIDEwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MubWF4TGlua0ZhY3RvciA9IG51bVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIG51bWJlci5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IFRGaWxlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU1JTZXR0aW5ncyB7XG4gICAgLy8gZmxhc2hjYXJkc1xuICAgIGZsYXNoY2FyZFRhZ3M6IHN0cmluZ1tdO1xuICAgIHNpbmdsZUxpbmVDb21tZW50T25TYW1lTGluZTogYm9vbGVhbjtcbiAgICBidXJ5UmVsYXRlZENhcmRzOiBib29sZWFuO1xuICAgIC8vIG5vdGVzXG4gICAgdGFnc1RvUmV2aWV3OiBzdHJpbmdbXTtcbiAgICBvcGVuUmFuZG9tTm90ZTogYm9vbGVhbjtcbiAgICBhdXRvTmV4dE5vdGU6IGJvb2xlYW47XG4gICAgZGlzYWJsZUZpbGVNZW51UmV2aWV3T3B0aW9uczogYm9vbGVhbjtcbiAgICAvLyBhbGdvcml0aG1cbiAgICBiYXNlRWFzZTogbnVtYmVyO1xuICAgIG1heExpbmtGYWN0b3I6IG51bWJlcjtcbiAgICBsYXBzZXNJbnRlcnZhbENoYW5nZTogbnVtYmVyO1xuICAgIGVhc3lCb251czogbnVtYmVyO1xufVxuXG5leHBvcnQgZW51bSBSZXZpZXdSZXNwb25zZSB7XG4gICAgRWFzeSxcbiAgICBHb29kLFxuICAgIEhhcmQsXG4gICAgUmVzZXQsXG59XG5cbi8vIE5vdGVzXG5cbmV4cG9ydCBpbnRlcmZhY2UgU2NoZWROb3RlIHtcbiAgICBub3RlOiBURmlsZTtcbiAgICBkdWVVbml4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGlua1N0YXQge1xuICAgIHNvdXJjZVBhdGg6IHN0cmluZztcbiAgICBsaW5rQ291bnQ6IG51bWJlcjtcbn1cblxuLy8gRmxhc2hjYXJkc1xuXG5leHBvcnQgaW50ZXJmYWNlIENhcmQge1xuICAgIC8vIHNjaGVkdWxpbmdcbiAgICBpc0R1ZTogYm9vbGVhbjtcbiAgICBpbnRlcnZhbD86IG51bWJlcjtcbiAgICBlYXNlPzogbnVtYmVyO1xuICAgIC8vIG5vdGVcbiAgICBub3RlOiBURmlsZTtcbiAgICAvLyB2aXN1YWxzXG4gICAgZnJvbnQ6IHN0cmluZztcbiAgICBiYWNrOiBzdHJpbmc7XG4gICAgY2FyZFRleHQ6IHN0cmluZztcbiAgICBjb250ZXh0OiBzdHJpbmc7XG4gICAgLy8gdHlwZXNcbiAgICBjYXJkVHlwZTogQ2FyZFR5cGU7XG4gICAgLy8gc3R1ZmYgZm9yIGNhcmRzIHdpdGggc3ViLWNhcmRzXG4gICAgc3ViQ2FyZElkeD86IG51bWJlcjtcbiAgICByZWxhdGVkQ2FyZHM/OiBDYXJkW107XG59XG5cbmV4cG9ydCBlbnVtIENhcmRUeXBlIHtcbiAgICBTaW5nbGVMaW5lQmFzaWMsXG4gICAgTXVsdGlMaW5lQmFzaWMsXG4gICAgQ2xvemUsXG59XG5cbmV4cG9ydCBlbnVtIEZsYXNoY2FyZE1vZGFsTW9kZSB7XG4gICAgRGVja3NMaXN0LFxuICAgIEZyb250LFxuICAgIEJhY2ssXG4gICAgQ2xvc2VkLFxufVxuIiwiaW1wb3J0IHsgUmV2aWV3UmVzcG9uc2UgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gc2NoZWR1bGUoXG4gICAgcmVzcG9uc2U6IFJldmlld1Jlc3BvbnNlLFxuICAgIGludGVydmFsOiBudW1iZXIsXG4gICAgZWFzZTogbnVtYmVyLFxuICAgIGxhcHNlc0ludGVydmFsQ2hhbmdlOiBudW1iZXIsXG4gICAgZWFzeUJvbnVzOiBudW1iZXIsXG4gICAgZnV6ejogYm9vbGVhbiA9IHRydWVcbikge1xuICAgIGlmIChyZXNwb25zZSAhPSBSZXZpZXdSZXNwb25zZS5Hb29kKSB7XG4gICAgICAgIGVhc2UgPVxuICAgICAgICAgICAgcmVzcG9uc2UgPT0gUmV2aWV3UmVzcG9uc2UuRWFzeVxuICAgICAgICAgICAgICAgID8gZWFzZSArIDIwXG4gICAgICAgICAgICAgICAgOiBNYXRoLm1heCgxMzAsIGVhc2UgLSAyMCk7XG4gICAgfVxuXG4gICAgaWYgKHJlc3BvbnNlID09IFJldmlld1Jlc3BvbnNlLkhhcmQpXG4gICAgICAgIGludGVydmFsID0gTWF0aC5tYXgoMSwgaW50ZXJ2YWwgKiBsYXBzZXNJbnRlcnZhbENoYW5nZSk7XG4gICAgZWxzZSBpbnRlcnZhbCA9IChpbnRlcnZhbCAqIGVhc2UpIC8gMTAwO1xuXG4gICAgaWYgKHJlc3BvbnNlID09IFJldmlld1Jlc3BvbnNlLkVhc3kpIGludGVydmFsICo9IGVhc3lCb251cztcblxuICAgIGlmIChmdXp6KSB7XG4gICAgICAgIC8vIGZ1enpcbiAgICAgICAgaWYgKGludGVydmFsID49IDgpIHtcbiAgICAgICAgICAgIGxldCBmdXp6ID0gWy0wLjA1ICogaW50ZXJ2YWwsIDAsIDAuMDUgKiBpbnRlcnZhbF07XG4gICAgICAgICAgICBpbnRlcnZhbCArPSBmdXp6W01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGZ1enoubGVuZ3RoKV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBpbnRlcnZhbDogTWF0aC5yb3VuZChpbnRlcnZhbCAqIDEwKSAvIDEwLCBlYXNlIH07XG59XG4iLCJleHBvcnQgY29uc3QgU0NIRURVTElOR19JTkZPX1JFR0VYID0gL14tLS1cXG4oKD86LipcXG4pKilzci1kdWU6ICguKylcXG5zci1pbnRlcnZhbDogKFxcZCspXFxuc3ItZWFzZTogKFxcZCspXFxuKCg/Oi4qXFxuKSopLS0tLztcbmV4cG9ydCBjb25zdCBZQU1MX0ZST05UX01BVFRFUl9SRUdFWCA9IC9eLS0tXFxuKCg/Oi4qXFxuKSo/KS0tLS87XG5leHBvcnQgY29uc3QgU0lOR0xFTElORV9DQVJEX1JFR0VYID0gL14oLispOjooLis/KVxcbj8oPzo8IS0tU1I6KC4rKSwoXFxkKyksKFxcZCspLS0+fCQpL2dtO1xuZXhwb3J0IGNvbnN0IE1VTFRJTElORV9DQVJEX1JFR0VYID0gL14oKD86LitcXG4pKylcXD9cXG4oKD86LitcXG4pKz8pKD86PCEtLVNSOiguKyksKFxcZCspLChcXGQrKS0tPnwkKS9nbTtcbmV4cG9ydCBjb25zdCBDTE9aRV9DQVJEX0RFVEVDVE9SID0gLyg/Oi4rXFxuKSpeLio/PT0uKj89PS4qXFxuKD86LitcXG4/KSovZ207IC8vIGNhcmQgbXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBjbG96ZVxuZXhwb3J0IGNvbnN0IENMT1pFX0RFTEVUSU9OU19FWFRSQUNUT1IgPSAvPT0oLio/KT09L2dtO1xuZXhwb3J0IGNvbnN0IENMT1pFX1NDSEVEVUxJTkdfRVhUUkFDVE9SID0gLyEoW1xcZC1dKyksKFxcZCspLChcXGQrKS9nbTtcblxuZXhwb3J0IGNvbnN0IENST1NTX0hBSVJTX0lDT04gPSBgPHBhdGggc3R5bGU9XCIgc3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOm5vbnplcm87ZmlsbDpjdXJyZW50Q29sb3I7ZmlsbC1vcGFjaXR5OjE7XCIgZD1cIk0gOTkuOTIxODc1IDQ3Ljk0MTQwNiBMIDkzLjA3NDIxOSA0Ny45NDE0MDYgQyA5Mi44NDM3NSA0Mi4wMzEyNSA5MS4zOTA2MjUgMzYuMjM4MjgxIDg4LjgwMDc4MSAzMC45MjE4NzUgTCA4NS4zNjcxODggMzIuNTgyMDMxIEMgODcuNjY3OTY5IDM3LjM1NTQ2OSA4OC45NjQ4NDQgNDIuNTUwNzgxIDg5LjE4MzU5NCA0Ny44NDM3NSBMIDgyLjIzODI4MSA0Ny44NDM3NSBDIDgyLjA5NzY1NiA0NC42MTcxODggODEuNTg5ODQ0IDQxLjQxNzk2OSA4MC43MzQzNzUgMzguMzA0Njg4IEwgNzcuMDUwNzgxIDM5LjMzNTkzOCBDIDc3LjgwODU5NCA0Mi4wODk4NDQgNzguMjYxNzE5IDQ0LjkxNzk2OSA3OC40MDYyNSA0Ny43Njk1MzEgTCA2NS44NzEwOTQgNDcuNzY5NTMxIEMgNjQuOTE0MDYyIDQwLjUwNzgxMiA1OS4xNDQ1MzEgMzQuODMyMDMxIDUxLjg3MTA5NCAzMy45OTYwOTQgTCA1MS44NzEwOTQgMjEuMzg2NzE5IEMgNTQuODE2NDA2IDIxLjUwNzgxMiA1Ny43NDIxODggMjEuOTYwOTM4IDYwLjU4NTkzOCAyMi43MzgyODEgTCA2MS42MTcxODggMTkuMDU4NTk0IEMgNTguNDM3NSAxOC4xOTE0MDYgNTUuMTY0MDYyIDE3LjY5MTQwNiA1MS44NzEwOTQgMTcuNTcwMzEyIEwgNTEuODcxMDk0IDEwLjU1MDc4MSBDIDU3LjE2NDA2MiAxMC43Njk1MzEgNjIuMzU1NDY5IDEyLjA2NjQwNiA2Ny4xMzI4MTIgMTQuMzYzMjgxIEwgNjguNzg5MDYyIDEwLjkyOTY4OCBDIDYzLjUgOC4zODI4MTIgNTcuNzM4MjgxIDYuOTUzMTI1IDUxLjg3MTA5NCA2LjczNDM3NSBMIDUxLjg3MTA5NCAwLjAzOTA2MjUgTCA0OC4wNTQ2ODggMC4wMzkwNjI1IEwgNDguMDU0Njg4IDYuNzM0Mzc1IEMgNDIuMTc5Njg4IDYuOTc2NTYyIDM2LjQxNzk2OSA4LjQzMzU5NCAzMS4xMzI4MTIgMTEuMDA3ODEyIEwgMzIuNzkyOTY5IDE0LjQ0MTQwNiBDIDM3LjU2NjQwNiAxMi4xNDA2MjUgNDIuNzYxNzE5IDEwLjg0Mzc1IDQ4LjA1NDY4OCAxMC42MjUgTCA0OC4wNTQ2ODggMTcuNTcwMzEyIEMgNDQuODI4MTI1IDE3LjcxNDg0NCA0MS42Mjg5MDYgMTguMjE4NzUgMzguNTE1NjI1IDE5LjA3ODEyNSBMIDM5LjU0Njg3NSAyMi43NTc4MTIgQyA0Mi4zMjQyMTkgMjEuOTg4MjgxIDQ1LjE3NTc4MSAyMS41MzEyNSA0OC4wNTQ2ODggMjEuMzg2NzE5IEwgNDguMDU0Njg4IDM0LjAzMTI1IEMgNDAuNzk2ODc1IDM0Ljk0OTIxOSAzNS4wODk4NDQgNDAuNjc5Njg4IDM0LjIwMzEyNSA0Ny45NDE0MDYgTCAyMS41IDQ3Ljk0MTQwNiBDIDIxLjYzMjgxMiA0NS4wNDI5NjkgMjIuMDg5ODQ0IDQyLjE3MTg3NSAyMi44NTU0NjkgMzkuMzc1IEwgMTkuMTcxODc1IDM4LjM0Mzc1IEMgMTguMzEyNSA0MS40NTcwMzEgMTcuODA4NTk0IDQ0LjY1NjI1IDE3LjY2NDA2MiA0Ny44ODI4MTIgTCAxMC42NjQwNjIgNDcuODgyODEyIEMgMTAuODgyODEyIDQyLjU4OTg0NCAxMi4xNzk2ODggMzcuMzk0NTMxIDE0LjQ4MDQ2OSAzMi42MjEwOTQgTCAxMS4xMjEwOTQgMzAuOTIxODc1IEMgOC41MzUxNTYgMzYuMjM4MjgxIDcuMDc4MTI1IDQyLjAzMTI1IDYuODQ3NjU2IDQ3Ljk0MTQwNiBMIDAgNDcuOTQxNDA2IEwgMCA1MS43NTM5MDYgTCA2Ljg0NzY1NiA1MS43NTM5MDYgQyA3LjA4OTg0NCA1Ny42MzY3MTkgOC41NDI5NjkgNjMuNDAyMzQ0IDExLjEyMTA5NCA2OC42OTUzMTIgTCAxNC41NTQ2ODggNjcuMDM1MTU2IEMgMTIuMjU3ODEyIDYyLjI2MTcxOSAxMC45NTcwMzEgNTcuMDY2NDA2IDEwLjczODI4MSA1MS43NzM0MzggTCAxNy43NDIxODggNTEuNzczNDM4IEMgMTcuODU1NDY5IDU1LjA0Mjk2OSAxOC4zNDM3NSA1OC4yODkwNjIgMTkuMTkxNDA2IDYxLjQ0NTMxMiBMIDIyLjg3MTA5NCA2MC40MTQwNjIgQyAyMi4wODk4NDQgNTcuNTYyNSAyMS42Mjg5MDYgNTQuNjMyODEyIDIxLjUgNTEuNjc5Njg4IEwgMzQuMjAzMTI1IDUxLjY3OTY4OCBDIDM1LjA1ODU5NCA1OC45Njg3NSA0MC43NzM0MzggNjQuNzM4MjgxIDQ4LjA1NDY4OCA2NS42NjAxNTYgTCA0OC4wNTQ2ODggNzguMzA4NTk0IEMgNDUuMTA1NDY5IDc4LjE4NzUgNDIuMTgzNTk0IDc3LjczMDQ2OSAzOS4zMzU5MzggNzYuOTU3MDMxIEwgMzguMzA0Njg4IDgwLjYzNjcxOSBDIDQxLjQ4ODI4MSA4MS41MTE3MTkgNDQuNzU3ODEyIDgyLjAxNTYyNSA0OC4wNTQ2ODggODIuMTQ0NTMxIEwgNDguMDU0Njg4IDg5LjE0NDUzMSBDIDQyLjc2MTcxOSA4OC45MjU3ODEgMzcuNTY2NDA2IDg3LjYyODkwNiAzMi43OTI5NjkgODUuMzI4MTI1IEwgMzEuMTMyODEyIDg4Ljc2NTYyNSBDIDM2LjQyNTc4MSA5MS4zMTI1IDQyLjE4MzU5NCA5Mi43NDIxODggNDguMDU0Njg4IDkyLjk2MDkzOCBMIDQ4LjA1NDY4OCA5OS45NjA5MzggTCA1MS44NzEwOTQgOTkuOTYwOTM4IEwgNTEuODcxMDk0IDkyLjk2MDkzOCBDIDU3Ljc1IDkyLjcxODc1IDYzLjUxOTUzMSA5MS4yNjU2MjUgNjguODA4NTk0IDg4LjY4NzUgTCA2Ny4xMzI4MTIgODUuMjUzOTA2IEMgNjIuMzU1NDY5IDg3LjU1MDc4MSA1Ny4xNjQwNjIgODguODUxNTYyIDUxLjg3MTA5NCA4OS4wNzAzMTIgTCA1MS44NzEwOTQgODIuMTI1IEMgNTUuMDkzNzUgODEuOTgwNDY5IDU4LjI5Mjk2OSA4MS40NzY1NjIgNjEuNDA2MjUgODAuNjE3MTg4IEwgNjAuMzc4OTA2IDc2LjkzNzUgQyA1Ny41NzQyMTkgNzcuNzAzMTI1IDU0LjY5NTMxMiA3OC4xNTYyNSA1MS43OTI5NjkgNzguMjg5MDYyIEwgNTEuNzkyOTY5IDY1LjY3OTY4OCBDIDU5LjEyMTA5NCA2NC44MjgxMjUgNjQuOTEwMTU2IDU5LjA2MjUgNjUuNzk2ODc1IDUxLjczNDM3NSBMIDc4LjM2NzE4OCA1MS43MzQzNzUgQyA3OC4yNSA1NC43MzQzNzUgNzcuNzg5MDYyIDU3LjcxMDkzOCA3Ni45OTIxODggNjAuNjA1NDY5IEwgODAuNjc1NzgxIDYxLjYzNjcxOSBDIDgxLjU1ODU5NCA1OC40MDYyNSA4Mi4wNjY0MDYgNTUuMDgyMDMxIDgyLjE4MzU5NCA1MS43MzQzNzUgTCA4OS4yNjE3MTkgNTEuNzM0Mzc1IEMgODkuMDQyOTY5IDU3LjAzMTI1IDg3Ljc0MjE4OCA2Mi4yMjI2NTYgODUuNDQ1MzEyIDY2Ljk5NjA5NCBMIDg4Ljg3ODkwNiA2OC42NTYyNSBDIDkxLjQ1NzAzMSA2My4zNjcxODggOTIuOTEwMTU2IDU3LjU5NzY1NiA5My4xNTIzNDQgNTEuNzE4NzUgTCAxMDAgNTEuNzE4NzUgWiBNIDYyLjAxOTUzMSA1MS43MzQzNzUgQyA2MS4xODM1OTQgNTYuOTQ1MzEyIDU3LjA4NTkzOCA2MS4wMjM0MzggNTEuODcxMDk0IDYxLjgyODEyNSBMIDUxLjg3MTA5NCA1Ny41MTU2MjUgTCA0OC4wNTQ2ODggNTcuNTE1NjI1IEwgNDguMDU0Njg4IDYxLjgwODU5NCBDIDQyLjkxMDE1NiA2MC45NDkyMTkgMzguODg2NzE5IDU2LjkwMjM0NCAzOC4wNTg1OTQgNTEuNzUzOTA2IEwgNDIuMzMyMDMxIDUxLjc1MzkwNiBMIDQyLjMzMjAzMSA0Ny45NDE0MDYgTCAzOC4wNTg1OTQgNDcuOTQxNDA2IEMgMzguODg2NzE5IDQyLjc4OTA2MiA0Mi45MTAxNTYgMzguNzQ2MDk0IDQ4LjA1NDY4OCAzNy44ODY3MTkgTCA0OC4wNTQ2ODggNDIuMTc5Njg4IEwgNTEuODcxMDk0IDQyLjE3OTY4OCBMIDUxLjg3MTA5NCAzNy44NDc2NTYgQyA1Ny4wNzgxMjUgMzguNjQ4NDM4IDYxLjE3OTY4OCA0Mi43MTg3NSA2Mi4wMTk1MzEgNDcuOTIxODc1IEwgNTcuNzA3MDMxIDQ3LjkyMTg3NSBMIDU3LjcwNzAzMSA1MS43MzQzNzUgWiBNIDYyLjAxOTUzMSA1MS43MzQzNzUgXCIvPmA7XG5leHBvcnQgY29uc3QgQ09MTEFQU0VfSUNPTiA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMTAwIDEwMFwiIHdpZHRoPVwiOFwiIGhlaWdodD1cIjhcIiBjbGFzcz1cInJpZ2h0LXRyaWFuZ2xlXCI+PHBhdGggZmlsbD1cImN1cnJlbnRDb2xvclwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIGQ9XCJNOTQuOSwyMC44Yy0xLjQtMi41LTQuMS00LjEtNy4xLTQuMUgxMi4yYy0zLDAtNS43LDEuNi03LjEsNC4xYy0xLjMsMi40LTEuMiw1LjIsMC4yLDcuNkw0My4xLDg4YzEuNSwyLjMsNCwzLjcsNi45LDMuNyBzNS40LTEuNCw2LjktMy43bDM3LjgtNTkuNkM5Ni4xLDI2LDk2LjIsMjMuMiw5NC45LDIwLjhMOTQuOSwyMC44elwiPjwvcGF0aD48L3N2Zz5gO1xuIiwiaW1wb3J0IHsgTW9kYWwsIEFwcCwgTWFya2Rvd25SZW5kZXJlciwgTm90aWNlLCBQbGF0Zm9ybSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgU1JQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgQ2FyZCwgQ2FyZFR5cGUsIEZsYXNoY2FyZE1vZGFsTW9kZSwgUmV2aWV3UmVzcG9uc2UgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHsgc2NoZWR1bGUgfSBmcm9tIFwiLi9zY2hlZFwiO1xuaW1wb3J0IHsgQ0xPWkVfU0NIRURVTElOR19FWFRSQUNUT1IgfSBmcm9tIFwiLi9jb25zdGFudHNcIjtcblxuZXhwb3J0IGNsYXNzIEZsYXNoY2FyZE1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHByaXZhdGUgcGx1Z2luOiBTUlBsdWdpbjtcbiAgICBwcml2YXRlIGFuc3dlckJ0bjogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBmbGFzaGNhcmRWaWV3OiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIGhhcmRCdG46IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgZ29vZEJ0bjogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBlYXN5QnRuOiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIHJlc3BvbnNlRGl2OiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIGZpbGVMaW5rVmlldzogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSByZXNldExpbmtWaWV3OiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIGNvbnRleHRWaWV3OiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIGN1cnJlbnRDYXJkOiBDYXJkO1xuICAgIHByaXZhdGUgY3VycmVudERlY2s6IHN0cmluZztcbiAgICBwcml2YXRlIG1vZGU6IEZsYXNoY2FyZE1vZGFsTW9kZTtcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFNSUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cbiAgICAgICAgdGhpcy50aXRsZUVsLnNldFRleHQoXCJEZWNrc1wiKTtcblxuICAgICAgICBpZiAoUGxhdGZvcm0uaXNNb2JpbGUpIHtcbiAgICAgICAgICAgIHRoaXMubW9kYWxFbC5zdHlsZS5oZWlnaHQgPSBcIjEwMCVcIjtcbiAgICAgICAgICAgIHRoaXMubW9kYWxFbC5zdHlsZS53aWR0aCA9IFwiMTAwJVwiO1xuICAgICAgICAgICAgdGhpcy5jb250ZW50RWwuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubW9kYWxFbC5zdHlsZS5oZWlnaHQgPSBcIjgwJVwiO1xuICAgICAgICAgICAgdGhpcy5tb2RhbEVsLnN0eWxlLndpZHRoID0gXCI0MCVcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29udGVudEVsLnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5zdHlsZS5oZWlnaHQgPSBcIjkyJVwiO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcyhcInNyLW1vZGFsLWNvbnRlbnRcIik7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5vbmtleXByZXNzID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLm1vZGUgIT0gRmxhc2hjYXJkTW9kYWxNb2RlLkRlY2tzTGlzdCkge1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlICE9IEZsYXNoY2FyZE1vZGFsTW9kZS5DbG9zZWQgJiZcbiAgICAgICAgICAgICAgICAgICAgZS5jb2RlID09IFwiS2V5U1wiXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRDYXJkLmlzRHVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZHVlRmxhc2hjYXJkc1t0aGlzLmN1cnJlbnREZWNrXS5zcGxpY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAxXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLnNwbGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDFcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRDYXJkLmNhcmRUeXBlID09IENhcmRUeXBlLkNsb3plKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5idXJ5UmVsYXRlZENhcmRzKHRoaXMuY3VycmVudENhcmQucmVsYXRlZENhcmRzKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZSA9PSBGbGFzaGNhcmRNb2RhbE1vZGUuRnJvbnQgJiZcbiAgICAgICAgICAgICAgICAgICAgKGUuY29kZSA9PSBcIlNwYWNlXCIgfHwgZS5jb2RlID09IFwiRW50ZXJcIilcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Fuc3dlcigpO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMubW9kZSA9PSBGbGFzaGNhcmRNb2RhbE1vZGUuQmFjaykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZS5jb2RlID09IFwiTnVtcGFkMVwiIHx8IGUuY29kZSA9PSBcIkRpZ2l0MVwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmV2aWV3KFJldmlld1Jlc3BvbnNlLkhhcmQpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmIChlLmNvZGUgPT0gXCJOdW1wYWQyXCIgfHwgZS5jb2RlID09IFwiRGlnaXQyXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXZpZXcoUmV2aWV3UmVzcG9uc2UuR29vZCk7XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKGUuY29kZSA9PSBcIk51bXBhZDNcIiB8fCBlLmNvZGUgPT0gXCJEaWdpdDNcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc1JldmlldyhSZXZpZXdSZXNwb25zZS5FYXN5KTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZS5jb2RlID09IFwiTnVtcGFkMFwiIHx8IGUuY29kZSA9PSBcIkRpZ2l0MFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmV2aWV3KFJldmlld1Jlc3BvbnNlLlJlc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgb25PcGVuKCkge1xuICAgICAgICB0aGlzLmRlY2tzTGlzdCgpO1xuICAgIH1cblxuICAgIG9uQ2xvc2UoKSB7XG4gICAgICAgIHRoaXMubW9kZSA9IEZsYXNoY2FyZE1vZGFsTW9kZS5DbG9zZWQ7XG4gICAgfVxuXG4gICAgZGVja3NMaXN0KCkge1xuICAgICAgICB0aGlzLm1vZGUgPSBGbGFzaGNhcmRNb2RhbE1vZGUuRGVja3NMaXN0O1xuICAgICAgICB0aGlzLnRpdGxlRWwuc2V0VGV4dChcIkRlY2tzXCIpO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSBcIlwiO1xuICAgICAgICBsZXQgY29sSGVhZGluZyA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdihcInNyLWRlY2tcIik7XG4gICAgICAgIGNvbEhlYWRpbmcuaW5uZXJIVE1MID1cbiAgICAgICAgICAgIFwiPGk+PC9pPjxzcGFuIHN0eWxlPSd0ZXh0LWFsaWduOnJpZ2h0Oyc+RHVlPC9zcGFuPlwiICtcbiAgICAgICAgICAgIFwiPHNwYW4gc3R5bGU9J3RleHQtYWxpZ246cmlnaHQ7Jz5OZXc8L3NwYW4+XCI7XG4gICAgICAgIGZvciAobGV0IGRlY2tOYW1lIGluIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMpIHtcbiAgICAgICAgICAgIGxldCBkZWNrVmlldyA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdihcInNyLWRlY2tcIik7XG4gICAgICAgICAgICBkZWNrVmlldy5zZXRUZXh0KGRlY2tOYW1lKTtcbiAgICAgICAgICAgIGRlY2tWaWV3LmlubmVySFRNTCArPVxuICAgICAgICAgICAgICAgIGA8c3BhbiBzdHlsZT1cImNvbG9yOiM0Y2FmNTA7dGV4dC1hbGlnbjpyaWdodDtcIj4ke3RoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHNbZGVja05hbWVdLmxlbmd0aH08L3NwYW4+YCArXG4gICAgICAgICAgICAgICAgYDxzcGFuIHN0eWxlPVwiY29sb3I6IzIxOTZmMzt0ZXh0LWFsaWduOnJpZ2h0O1wiPiR7dGhpcy5wbHVnaW4ubmV3Rmxhc2hjYXJkc1tkZWNrTmFtZV0ubGVuZ3RofTwvc3Bhbj5gO1xuICAgICAgICAgICAgZGVja1ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50RGVjayA9IGRlY2tOYW1lO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBDYXJkc1ZpZXcoKTtcbiAgICAgICAgICAgICAgICB0aGlzLm5leHRDYXJkKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldHVwQ2FyZHNWaWV3KCkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5pbm5lckhUTUwgPSBcIlwiO1xuXG4gICAgICAgIHRoaXMuZmlsZUxpbmtWaWV3ID0gY3JlYXRlRGl2KFwic3ItbGlua1wiKTtcbiAgICAgICAgdGhpcy5maWxlTGlua1ZpZXcuc2V0VGV4dChcIk9wZW4gZmlsZVwiKTtcbiAgICAgICAgdGhpcy5maWxlTGlua1ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLmFjdGl2ZUxlYWYub3BlbkZpbGUoXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5ub3RlXG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQodGhpcy5maWxlTGlua1ZpZXcpO1xuXG4gICAgICAgIHRoaXMucmVzZXRMaW5rVmlldyA9IGNyZWF0ZURpdihcInNyLWxpbmtcIik7XG4gICAgICAgIHRoaXMucmVzZXRMaW5rVmlldy5zZXRUZXh0KFwiUmVzZXQgY2FyZCdzIHByb2dyZXNzXCIpO1xuICAgICAgICB0aGlzLnJlc2V0TGlua1ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXZpZXcoUmV2aWV3UmVzcG9uc2UuUmVzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXNldExpbmtWaWV3LnN0eWxlLmZsb2F0ID0gXCJyaWdodFwiO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCh0aGlzLnJlc2V0TGlua1ZpZXcpO1xuXG4gICAgICAgIHRoaXMuY29udGV4dFZpZXcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICB0aGlzLmNvbnRleHRWaWV3LnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItY29udGV4dFwiKTtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQodGhpcy5jb250ZXh0Vmlldyk7XG5cbiAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItZmxhc2hjYXJkLXZpZXdcIik7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMuZmxhc2hjYXJkVmlldyk7XG5cbiAgICAgICAgdGhpcy5yZXNwb25zZURpdiA9IGNyZWF0ZURpdihcInNyLXJlc3BvbnNlXCIpO1xuXG4gICAgICAgIHRoaXMuaGFyZEJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgICAgIHRoaXMuaGFyZEJ0bi5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInNyLWhhcmQtYnRuXCIpO1xuICAgICAgICB0aGlzLmhhcmRCdG4uc2V0VGV4dChcIkhhcmRcIik7XG4gICAgICAgIHRoaXMuaGFyZEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKF8pID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc1JldmlldyhSZXZpZXdSZXNwb25zZS5IYXJkKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVzcG9uc2VEaXYuYXBwZW5kQ2hpbGQodGhpcy5oYXJkQnRuKTtcblxuICAgICAgICB0aGlzLmdvb2RCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICAgICAgICB0aGlzLmdvb2RCdG4uc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJzci1nb29kLWJ0blwiKTtcbiAgICAgICAgdGhpcy5nb29kQnRuLnNldFRleHQoXCJHb29kXCIpO1xuICAgICAgICB0aGlzLmdvb2RCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXZpZXcoUmV2aWV3UmVzcG9uc2UuR29vZCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGl2LmFwcGVuZENoaWxkKHRoaXMuZ29vZEJ0bik7XG5cbiAgICAgICAgdGhpcy5lYXN5QnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgdGhpcy5lYXN5QnRuLnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItZWFzeS1idG5cIik7XG4gICAgICAgIHRoaXMuZWFzeUJ0bi5zZXRUZXh0KFwiRWFzeVwiKTtcbiAgICAgICAgdGhpcy5lYXN5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoXykgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmV2aWV3KFJldmlld1Jlc3BvbnNlLkVhc3kpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXNwb25zZURpdi5hcHBlbmRDaGlsZCh0aGlzLmVhc3lCdG4pO1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGl2LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcblxuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCh0aGlzLnJlc3BvbnNlRGl2KTtcblxuICAgICAgICB0aGlzLmFuc3dlckJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICAgIHRoaXMuYW5zd2VyQnRuLnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3Itc2hvdy1hbnN3ZXJcIik7XG4gICAgICAgIHRoaXMuYW5zd2VyQnRuLnNldFRleHQoXCJTaG93IEFuc3dlclwiKTtcbiAgICAgICAgdGhpcy5hbnN3ZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnNob3dBbnN3ZXIoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMuYW5zd2VyQnRuKTtcbiAgICB9XG5cbiAgICBuZXh0Q2FyZCgpIHtcbiAgICAgICAgdGhpcy5yZXNwb25zZURpdi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIHRoaXMucmVzZXRMaW5rVmlldy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGxldCBjb3VudCA9XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLmxlbmd0aCArXG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLmxlbmd0aDtcbiAgICAgICAgdGhpcy50aXRsZUVsLnNldFRleHQoYCR7dGhpcy5jdXJyZW50RGVja30gLSAke2NvdW50fWApO1xuXG4gICAgICAgIGlmIChjb3VudCA9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmRlY2tzTGlzdCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hbnN3ZXJCdG4uc3R5bGUuZGlzcGxheSA9IFwiaW5pdGlhbFwiO1xuICAgICAgICB0aGlzLmZsYXNoY2FyZFZpZXcuaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgdGhpcy5tb2RlID0gRmxhc2hjYXJkTW9kYWxNb2RlLkZyb250O1xuXG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQgPSB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdWzBdO1xuICAgICAgICAgICAgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmZyb250LFxuICAgICAgICAgICAgICAgIHRoaXMuZmxhc2hjYXJkVmlldyxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLm5vdGUucGF0aCxcbiAgICAgICAgICAgICAgICBudWxsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBsZXQgaGFyZEludGVydmFsID0gc2NoZWR1bGUoXG4gICAgICAgICAgICAgICAgUmV2aWV3UmVzcG9uc2UuSGFyZCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmludGVydmFsLFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuZWFzZSxcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlLFxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuZWFzeUJvbnVzLFxuICAgICAgICAgICAgICAgIGZhbHNlXG4gICAgICAgICAgICApLmludGVydmFsO1xuICAgICAgICAgICAgbGV0IGdvb2RJbnRlcnZhbCA9IHNjaGVkdWxlKFxuICAgICAgICAgICAgICAgIFJldmlld1Jlc3BvbnNlLkdvb2QsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5pbnRlcnZhbCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmVhc2UsXG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5sYXBzZXNJbnRlcnZhbENoYW5nZSxcbiAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmVhc3lCb251cyxcbiAgICAgICAgICAgICAgICBmYWxzZVxuICAgICAgICAgICAgKS5pbnRlcnZhbDtcbiAgICAgICAgICAgIGxldCBlYXN5SW50ZXJ2YWwgPSBzY2hlZHVsZShcbiAgICAgICAgICAgICAgICBSZXZpZXdSZXNwb25zZS5FYXN5LFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuaW50ZXJ2YWwsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5lYXNlLFxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MubGFwc2VzSW50ZXJ2YWxDaGFuZ2UsXG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5lYXN5Qm9udXMsXG4gICAgICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgICAgICkuaW50ZXJ2YWw7XG5cbiAgICAgICAgICAgIGlmIChQbGF0Zm9ybS5pc01vYmlsZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFyZEJ0bi5zZXRUZXh0KGAke2hhcmRJbnRlcnZhbH1kYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5nb29kQnRuLnNldFRleHQoYCR7Z29vZEludGVydmFsfWRgKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVhc3lCdG4uc2V0VGV4dChgJHtlYXN5SW50ZXJ2YWx9ZGApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhcmRCdG4uc2V0VGV4dChgSGFyZCAtICR7aGFyZEludGVydmFsfSBkYXkocylgKTtcbiAgICAgICAgICAgICAgICB0aGlzLmdvb2RCdG4uc2V0VGV4dChgR29vZCAtICR7Z29vZEludGVydmFsfSBkYXkocylgKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVhc3lCdG4uc2V0VGV4dChgRWFzeSAtICR7ZWFzeUludGVydmFsfSBkYXkocylgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQgPSB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdWzBdO1xuICAgICAgICAgICAgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmZyb250LFxuICAgICAgICAgICAgICAgIHRoaXMuZmxhc2hjYXJkVmlldyxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLm5vdGUucGF0aCxcbiAgICAgICAgICAgICAgICBudWxsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoUGxhdGZvcm0uaXNNb2JpbGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhcmRCdG4uc2V0VGV4dChcIjEuMGRcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5nb29kQnRuLnNldFRleHQoXCIyLjVkXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuZWFzeUJ0bi5zZXRUZXh0KFwiMy41ZFwiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5oYXJkQnRuLnNldFRleHQoXCJIYXJkIC0gMS4wIGRheShzKVwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLmdvb2RCdG4uc2V0VGV4dChcIkdvb2QgLSAyLjUgZGF5KHMpXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuZWFzeUJ0bi5zZXRUZXh0KFwiRWFzeSAtIDMuNSBkYXkocylcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnRleHRWaWV3LnNldFRleHQodGhpcy5jdXJyZW50Q2FyZC5jb250ZXh0KTtcbiAgICB9XG5cbiAgICBzaG93QW5zd2VyKCkge1xuICAgICAgICB0aGlzLm1vZGUgPSBGbGFzaGNhcmRNb2RhbE1vZGUuQmFjaztcblxuICAgICAgICB0aGlzLmFuc3dlckJ0bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIHRoaXMucmVzcG9uc2VEaXYuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiO1xuXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRDYXJkLmlzRHVlKVxuICAgICAgICAgICAgdGhpcy5yZXNldExpbmtWaWV3LnN0eWxlLmRpc3BsYXkgPSBcImlubGluZS1ibG9ja1wiO1xuXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRDYXJkLmNhcmRUeXBlICE9IENhcmRUeXBlLkNsb3plKSB7XG4gICAgICAgICAgICBsZXQgaHIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaHJcIik7XG4gICAgICAgICAgICBoci5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInNyLWhyLWNhcmQtZGl2aWRlXCIpO1xuICAgICAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LmFwcGVuZENoaWxkKGhyKTtcbiAgICAgICAgfSBlbHNlIHRoaXMuZmxhc2hjYXJkVmlldy5pbm5lckhUTUwgPSBcIlwiO1xuXG4gICAgICAgIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmJhY2ssXG4gICAgICAgICAgICB0aGlzLmZsYXNoY2FyZFZpZXcsXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLm5vdGUucGF0aCxcbiAgICAgICAgICAgIG51bGxcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBhc3luYyBwcm9jZXNzUmV2aWV3KHJlc3BvbnNlOiBSZXZpZXdSZXNwb25zZSkge1xuICAgICAgICBsZXQgaW50ZXJ2YWwsIGVhc2UsIGR1ZTtcblxuICAgICAgICBpZiAocmVzcG9uc2UgIT0gUmV2aWV3UmVzcG9uc2UuUmVzZXQpIHtcbiAgICAgICAgICAgIC8vIHNjaGVkdWxlZCBjYXJkXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5pc0R1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHNbdGhpcy5jdXJyZW50RGVja10uc3BsaWNlKDAsIDEpO1xuICAgICAgICAgICAgICAgIGxldCBzY2hlZE9iaiA9IHNjaGVkdWxlKFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZSxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5pbnRlcnZhbCxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5lYXNlLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmVhc3lCb251c1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBNYXRoLnJvdW5kKHNjaGVkT2JqLmludGVydmFsKTtcbiAgICAgICAgICAgICAgICBlYXNlID0gc2NoZWRPYmouZWFzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IHNjaGVkT2JqID0gc2NoZWR1bGUoXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlLFxuICAgICAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJhc2VFYXNlLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmVhc3lCb251c1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ubmV3Rmxhc2hjYXJkc1t0aGlzLmN1cnJlbnREZWNrXS5zcGxpY2UoMCwgMSk7XG4gICAgICAgICAgICAgICAgaW50ZXJ2YWwgPSBNYXRoLnJvdW5kKHNjaGVkT2JqLmludGVydmFsKTtcbiAgICAgICAgICAgICAgICBlYXNlID0gc2NoZWRPYmouZWFzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZHVlID0gd2luZG93Lm1vbWVudChEYXRlLm5vdygpICsgaW50ZXJ2YWwgKiAyNCAqIDM2MDAgKiAxMDAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGludGVydmFsID0gMS4wO1xuICAgICAgICAgICAgZWFzZSA9IHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2U7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLnNwbGljZSgwLCAxKTtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHNbdGhpcy5jdXJyZW50RGVja10ucHVzaCh0aGlzLmN1cnJlbnRDYXJkKTtcbiAgICAgICAgICAgIGR1ZSA9IHdpbmRvdy5tb21lbnQoRGF0ZS5ub3coKSk7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFwiQ2FyZCdzIHByb2dyZXNzIGhhcyBiZWVuIHJlc2V0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGR1ZVN0cmluZyA9IGR1ZS5mb3JtYXQoXCJZWVlZLU1NLUREXCIpO1xuXG4gICAgICAgIGxldCBmaWxlVGV4dCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQodGhpcy5jdXJyZW50Q2FyZC5ub3RlKTtcbiAgICAgICAgbGV0IHJlcGxhY2VtZW50UmVnZXggPSBuZXcgUmVnRXhwKFxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5jYXJkVGV4dC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIiksIC8vIGVzY2FwZSBzdHJpbmdcbiAgICAgICAgICAgIFwiZ21cIlxuICAgICAgICApO1xuXG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRDYXJkLmNhcmRUeXBlID09IENhcmRUeXBlLkNsb3plKSB7XG4gICAgICAgICAgICBsZXQgc2NoZWRJZHggPSB0aGlzLmN1cnJlbnRDYXJkLmNhcmRUZXh0Lmxhc3RJbmRleE9mKFwiPCEtLVNSOlwiKTtcbiAgICAgICAgICAgIGlmIChzY2hlZElkeCA9PSAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IHRpbWUgYWRkaW5nIHNjaGVkdWxpbmcgaW5mb3JtYXRpb24gdG8gZmxhc2hjYXJkXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5jYXJkVGV4dCA9IGAke3RoaXMuY3VycmVudENhcmQuY2FyZFRleHR9XFxuPCEtLVNSOiEke2R1ZVN0cmluZ30sJHtpbnRlcnZhbH0sJHtlYXNlfS0tPmA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCBzY2hlZHVsaW5nID0gW1xuICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmN1cnJlbnRDYXJkLmNhcmRUZXh0Lm1hdGNoQWxsKFxuICAgICAgICAgICAgICAgICAgICAgICAgQ0xPWkVfU0NIRURVTElOR19FWFRSQUNUT1JcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgICAgbGV0IGRlbGV0aW9uU2NoZWQgPSBbXCIwXCIsIGR1ZVN0cmluZywgYCR7aW50ZXJ2YWx9YCwgYCR7ZWFzZX1gXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5pc0R1ZSlcbiAgICAgICAgICAgICAgICAgICAgc2NoZWR1bGluZ1t0aGlzLmN1cnJlbnRDYXJkLnN1YkNhcmRJZHhdID0gZGVsZXRpb25TY2hlZDtcbiAgICAgICAgICAgICAgICBlbHNlIHNjaGVkdWxpbmcucHVzaChkZWxldGlvblNjaGVkKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuY2FyZFRleHQgPSB0aGlzLmN1cnJlbnRDYXJkLmNhcmRUZXh0LnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgIC88IS0tU1I6ListLT4vZ20sXG4gICAgICAgICAgICAgICAgICAgIFwiXCJcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuY2FyZFRleHQgKz0gXCI8IS0tU1I6XCI7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2hlZHVsaW5nLmxlbmd0aDsgaSsrKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmNhcmRUZXh0ICs9IGAhJHtzY2hlZHVsaW5nW2ldWzFdfSwke3NjaGVkdWxpbmdbaV1bMl19LCR7c2NoZWR1bGluZ1tpXVszXX1gO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuY2FyZFRleHQgKz0gXCItLT5cIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmlsZVRleHQgPSBmaWxlVGV4dC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50UmVnZXgsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5jYXJkVGV4dFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGZvciAobGV0IHJlbGF0ZWRDYXJkIG9mIHRoaXMuY3VycmVudENhcmQucmVsYXRlZENhcmRzKVxuICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkLmNhcmRUZXh0ID0gdGhpcy5jdXJyZW50Q2FyZC5jYXJkVGV4dDtcbiAgICAgICAgICAgIGlmICh0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJ1cnlSZWxhdGVkQ2FyZHMpXG4gICAgICAgICAgICAgICAgdGhpcy5idXJ5UmVsYXRlZENhcmRzKHRoaXMuY3VycmVudENhcmQucmVsYXRlZENhcmRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnRDYXJkLmNhcmRUeXBlID09IENhcmRUeXBlLlNpbmdsZUxpbmVCYXNpYykge1xuICAgICAgICAgICAgICAgIGxldCBzZXAgPSB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLnNpbmdsZUxpbmVDb21tZW50T25TYW1lTGluZVxuICAgICAgICAgICAgICAgICAgICA/IFwiIFwiXG4gICAgICAgICAgICAgICAgICAgIDogXCJcXG5cIjtcblxuICAgICAgICAgICAgICAgIGZpbGVUZXh0ID0gZmlsZVRleHQucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgcmVwbGFjZW1lbnRSZWdleCxcbiAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5jdXJyZW50Q2FyZC5mcm9udH06OiR7dGhpcy5jdXJyZW50Q2FyZC5iYWNrfSR7c2VwfTwhLS1TUjoke2R1ZVN0cmluZ30sJHtpbnRlcnZhbH0sJHtlYXNlfS0tPmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaWxlVGV4dCA9IGZpbGVUZXh0LnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50UmVnZXgsXG4gICAgICAgICAgICAgICAgICAgIGAke3RoaXMuY3VycmVudENhcmQuZnJvbnR9XFxuP1xcbiR7dGhpcy5jdXJyZW50Q2FyZC5iYWNrfVxcbjwhLS1TUjoke2R1ZVN0cmluZ30sJHtpbnRlcnZhbH0sJHtlYXNlfS0tPmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHRoaXMuY3VycmVudENhcmQubm90ZSwgZmlsZVRleHQpO1xuICAgICAgICB0aGlzLm5leHRDYXJkKCk7XG4gICAgfVxuXG4gICAgYnVyeVJlbGF0ZWRDYXJkcyhhcnI6IENhcmRbXSkge1xuICAgICAgICBmb3IgKGxldCByZWxhdGVkQ2FyZCBvZiBhcnIpIHtcbiAgICAgICAgICAgIGxldCBkdWVJZHggPSB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzW3RoaXMuY3VycmVudERlY2tdLmluZGV4T2YoXG4gICAgICAgICAgICAgICAgcmVsYXRlZENhcmRcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBsZXQgbmV3SWR4ID0gdGhpcy5wbHVnaW4ubmV3Rmxhc2hjYXJkc1t0aGlzLmN1cnJlbnREZWNrXS5pbmRleE9mKFxuICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoZHVlSWR4ICE9IC0xKVxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHNbdGhpcy5jdXJyZW50RGVja10uc3BsaWNlKGR1ZUlkeCwgMSk7XG4gICAgICAgICAgICBlbHNlIGlmIChuZXdJZHggIT0gLTEpXG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4ubmV3Rmxhc2hjYXJkc1t0aGlzLmN1cnJlbnREZWNrXS5zcGxpY2UobmV3SWR4LCAxKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IEl0ZW1WaWV3LCBXb3Jrc3BhY2VMZWFmLCBNZW51LCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgU1JQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgQ09MTEFQU0VfSUNPTiB9IGZyb20gXCIuL2NvbnN0YW50c1wiO1xuXG5leHBvcnQgY29uc3QgUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSA9IFwicmV2aWV3LXF1ZXVlLWxpc3Qtdmlld1wiO1xuXG5leHBvcnQgY2xhc3MgUmV2aWV3UXVldWVMaXN0VmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgICBwcml2YXRlIHBsdWdpbjogU1JQbHVnaW47XG4gICAgcHJpdmF0ZSBhY3RpdmVGb2xkZXJzOiBTZXQ8c3RyaW5nPjtcblxuICAgIGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHBsdWdpbjogU1JQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIobGVhZik7XG5cbiAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgICAgIHRoaXMuYWN0aXZlRm9sZGVycyA9IG5ldyBTZXQoW1wiVG9kYXlcIl0pO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW9wZW5cIiwgKF86IGFueSkgPT4gdGhpcy5yZWRyYXcoKSlcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgICAgICAgdGhpcy5hcHAudmF1bHQub24oXCJyZW5hbWVcIiwgKF86IGFueSkgPT4gdGhpcy5yZWRyYXcoKSlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Vmlld1R5cGUoKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIFJFVklFV19RVUVVRV9WSUVXX1RZUEU7XG4gICAgfVxuXG4gICAgcHVibGljIGdldERpc3BsYXlUZXh0KCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBcIk5vdGVzIFJldmlldyBRdWV1ZVwiO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRJY29uKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBcImNyb3NzaGFpcnNcIjtcbiAgICB9XG5cbiAgICBwdWJsaWMgb25IZWFkZXJNZW51KG1lbnU6IE1lbnUpIHtcbiAgICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG4gICAgICAgICAgICBpdGVtLnNldFRpdGxlKFwiQ2xvc2VcIilcbiAgICAgICAgICAgICAgICAuc2V0SWNvbihcImNyb3NzXCIpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFxuICAgICAgICAgICAgICAgICAgICAgICAgUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgcmVkcmF3KCkge1xuICAgICAgICBjb25zdCBvcGVuRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cbiAgICAgICAgY29uc3Qgcm9vdEVsID0gY3JlYXRlRGl2KFwibmF2LWZvbGRlciBtb2Qtcm9vdFwiKTtcbiAgICAgICAgY29uc3QgY2hpbGRyZW5FbCA9IHJvb3RFbC5jcmVhdGVEaXYoXCJuYXYtZm9sZGVyLWNoaWxkcmVuXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLnBsdWdpbi5uZXdOb3Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm90ZXNGb2xkZXJFbCA9IHRoaXMuY3JlYXRlUmlnaHRQYW5lRm9sZGVyKFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuRWwsXG4gICAgICAgICAgICAgICAgXCJOZXdcIixcbiAgICAgICAgICAgICAgICAhdGhpcy5hY3RpdmVGb2xkZXJzLmhhcyhcIk5ld1wiKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbmV3RmlsZSBvZiB0aGlzLnBsdWdpbi5uZXdOb3Rlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlUmlnaHRQYW5lRmlsZShcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm90ZXNGb2xkZXJFbCxcbiAgICAgICAgICAgICAgICAgICAgbmV3RmlsZSxcbiAgICAgICAgICAgICAgICAgICAgb3BlbkZpbGUgJiYgbmV3RmlsZS5wYXRoID09PSBvcGVuRmlsZS5wYXRoLFxuICAgICAgICAgICAgICAgICAgICAhdGhpcy5hY3RpdmVGb2xkZXJzLmhhcyhcIk5ld1wiKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wbHVnaW4uc2NoZWR1bGVkTm90ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5vdzogbnVtYmVyID0gRGF0ZS5ub3coKTtcbiAgICAgICAgICAgIGxldCBjdXJyVW5peCA9IC0xO1xuICAgICAgICAgICAgbGV0IGZvbGRlckVsLCBmb2xkZXJUaXRsZTtcblxuICAgICAgICAgICAgZm9yIChsZXQgc05vdGUgb2YgdGhpcy5wbHVnaW4uc2NoZWR1bGVkTm90ZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoc05vdGUuZHVlVW5peCAhPSBjdXJyVW5peCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgbkRheXMgPSBNYXRoLmNlaWwoXG4gICAgICAgICAgICAgICAgICAgICAgICAoc05vdGUuZHVlVW5peCAtIG5vdykgLyAoMjQgKiAzNjAwICogMTAwMClcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgZm9sZGVyVGl0bGUgPVxuICAgICAgICAgICAgICAgICAgICAgICAgbkRheXMgPT0gLTFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiWWVzdGVyZGF5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IG5EYXlzID09IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiVG9kYXlcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogbkRheXMgPT0gMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gXCJUb21vcnJvd1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBuZXcgRGF0ZShzTm90ZS5kdWVVbml4KS50b0RhdGVTdHJpbmcoKTtcblxuICAgICAgICAgICAgICAgICAgICBmb2xkZXJFbCA9IHRoaXMuY3JlYXRlUmlnaHRQYW5lRm9sZGVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5FbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvbGRlclRpdGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgIXRoaXMuYWN0aXZlRm9sZGVycy5oYXMoZm9sZGVyVGl0bGUpXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJVbml4ID0gc05vdGUuZHVlVW5peDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZpbGUoXG4gICAgICAgICAgICAgICAgICAgIGZvbGRlckVsLFxuICAgICAgICAgICAgICAgICAgICBzTm90ZS5ub3RlLFxuICAgICAgICAgICAgICAgICAgICBvcGVuRmlsZSAmJiBzTm90ZS5ub3RlLnBhdGggPT09IG9wZW5GaWxlLnBhdGgsXG4gICAgICAgICAgICAgICAgICAgICF0aGlzLmFjdGl2ZUZvbGRlcnMuaGFzKGZvbGRlclRpdGxlKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb250ZW50RWwgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xuICAgICAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICAgICAgY29udGVudEVsLmFwcGVuZENoaWxkKHJvb3RFbCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVSaWdodFBhbmVGb2xkZXIoXG4gICAgICAgIHBhcmVudEVsOiBhbnksXG4gICAgICAgIGZvbGRlclRpdGxlOiBzdHJpbmcsXG4gICAgICAgIGNvbGxhcHNlZDogYm9vbGVhblxuICAgICk6IGFueSB7XG4gICAgICAgIGNvbnN0IGZvbGRlckVsID0gcGFyZW50RWwuY3JlYXRlRGl2KFwibmF2LWZvbGRlclwiKTtcbiAgICAgICAgY29uc3QgZm9sZGVyVGl0bGVFbCA9IGZvbGRlckVsLmNyZWF0ZURpdihcIm5hdi1mb2xkZXItdGl0bGVcIik7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuRWwgPSBmb2xkZXJFbC5jcmVhdGVEaXYoXCJuYXYtZm9sZGVyLWNoaWxkcmVuXCIpO1xuICAgICAgICBjb25zdCBjb2xsYXBzZUljb25FbCA9IGZvbGRlclRpdGxlRWwuY3JlYXRlRGl2KFxuICAgICAgICAgICAgXCJuYXYtZm9sZGVyLWNvbGxhcHNlLWluZGljYXRvciBjb2xsYXBzZS1pY29uXCJcbiAgICAgICAgKTtcbiAgICAgICAgY29sbGFwc2VJY29uRWwuaW5uZXJIVE1MID0gQ09MTEFQU0VfSUNPTjtcblxuICAgICAgICBpZiAoY29sbGFwc2VkKVxuICAgICAgICAgICAgY29sbGFwc2VJY29uRWwuY2hpbGROb2Rlc1swXS5zdHlsZS50cmFuc2Zvcm0gPSBcInJvdGF0ZSgtOTBkZWcpXCI7XG5cbiAgICAgICAgZm9sZGVyVGl0bGVFbFxuICAgICAgICAgICAgLmNyZWF0ZURpdihcIm5hdi1mb2xkZXItdGl0bGUtY29udGVudFwiKVxuICAgICAgICAgICAgLnNldFRleHQoZm9sZGVyVGl0bGUpO1xuXG4gICAgICAgIGZvbGRlclRpdGxlRWwub25DbGlja0V2ZW50KChfOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGZvciAobGV0IGNoaWxkIG9mIGNoaWxkcmVuRWwuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9PSBcImJsb2NrXCIgfHxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9PSBcIlwiXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgICAgICAgICAgICAgY29sbGFwc2VJY29uRWwuY2hpbGROb2Rlc1swXS5zdHlsZS50cmFuc2Zvcm0gPVxuICAgICAgICAgICAgICAgICAgICAgICAgXCJyb3RhdGUoLTkwZGVnKVwiO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZUZvbGRlcnMuZGVsZXRlKGZvbGRlclRpdGxlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICAgICAgICAgICAgICBjb2xsYXBzZUljb25FbC5jaGlsZE5vZGVzWzBdLnN0eWxlLnRyYW5zZm9ybSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWN0aXZlRm9sZGVycy5hZGQoZm9sZGVyVGl0bGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuRWw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVSaWdodFBhbmVGaWxlKFxuICAgICAgICBmb2xkZXJFbDogYW55LFxuICAgICAgICBmaWxlOiBURmlsZSxcbiAgICAgICAgZmlsZUVsQWN0aXZlOiBib29sZWFuLFxuICAgICAgICBoaWRkZW46IGJvb2xlYW5cbiAgICApIHtcbiAgICAgICAgY29uc3QgbmF2RmlsZUVsID0gZm9sZGVyRWwuY3JlYXRlRGl2KFwibmF2LWZpbGVcIik7XG4gICAgICAgIGlmIChoaWRkZW4pIG5hdkZpbGVFbC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cbiAgICAgICAgY29uc3QgbmF2RmlsZVRpdGxlID0gbmF2RmlsZUVsLmNyZWF0ZURpdihcIm5hdi1maWxlLXRpdGxlXCIpO1xuICAgICAgICBpZiAoZmlsZUVsQWN0aXZlKSBuYXZGaWxlVGl0bGUuYWRkQ2xhc3MoXCJpcy1hY3RpdmVcIik7XG5cbiAgICAgICAgbmF2RmlsZVRpdGxlLmNyZWF0ZURpdihcIm5hdi1maWxlLXRpdGxlLWNvbnRlbnRcIikuc2V0VGV4dChmaWxlLmJhc2VuYW1lKTtcbiAgICAgICAgbmF2RmlsZVRpdGxlLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgICBcImNsaWNrXCIsXG4gICAgICAgICAgICAoZXZlbnQ6IE1vdXNlRXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLm9wZW5GaWxlKGZpbGUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuXG4gICAgICAgIG5hdkZpbGVUaXRsZS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgXCJjb250ZXh0bWVudVwiLFxuICAgICAgICAgICAgKGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlTWVudSA9IG5ldyBNZW51KHRoaXMuYXBwKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UudHJpZ2dlcihcbiAgICAgICAgICAgICAgICAgICAgXCJmaWxlLW1lbnVcIixcbiAgICAgICAgICAgICAgICAgICAgZmlsZU1lbnUsXG4gICAgICAgICAgICAgICAgICAgIGZpbGUsXG4gICAgICAgICAgICAgICAgICAgIFwibXktY29udGV4dC1tZW51XCIsXG4gICAgICAgICAgICAgICAgICAgIG51bGxcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGZpbGVNZW51LnNob3dBdFBvc2l0aW9uKHtcbiAgICAgICAgICAgICAgICAgICAgeDogZXZlbnQucGFnZVgsXG4gICAgICAgICAgICAgICAgICAgIHk6IGV2ZW50LnBhZ2VZLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmYWxzZVxuICAgICAgICApO1xuICAgIH1cbn1cbiIsImltcG9ydCB7XHJcbiAgICBOb3RpY2UsXHJcbiAgICBQbHVnaW4sXHJcbiAgICBhZGRJY29uLFxyXG4gICAgVEZpbGUsXHJcbiAgICBIZWFkaW5nQ2FjaGUsXHJcbiAgICBnZXRBbGxUYWdzLFxyXG59IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgKiBhcyBncmFwaCBmcm9tIFwicGFnZXJhbmsuanNcIjtcclxuaW1wb3J0IHsgU1JTZXR0aW5nVGFiLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgRmxhc2hjYXJkTW9kYWwgfSBmcm9tIFwiLi9mbGFzaGNhcmQtbW9kYWxcIjtcclxuaW1wb3J0IHsgUmV2aWV3UXVldWVMaXN0VmlldywgUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSB9IGZyb20gXCIuL3NpZGViYXJcIjtcclxuaW1wb3J0IHsgc2NoZWR1bGUgfSBmcm9tIFwiLi9zY2hlZFwiO1xyXG5pbXBvcnQge1xyXG4gICAgU2NoZWROb3RlLFxyXG4gICAgTGlua1N0YXQsXHJcbiAgICBDYXJkLFxyXG4gICAgQ2FyZFR5cGUsXHJcbiAgICBSZXZpZXdSZXNwb25zZSxcclxuICAgIFNSU2V0dGluZ3MsXHJcbn0gZnJvbSBcIi4vdHlwZXNcIjtcclxuaW1wb3J0IHtcclxuICAgIENST1NTX0hBSVJTX0lDT04sXHJcbiAgICBTQ0hFRFVMSU5HX0lORk9fUkVHRVgsXHJcbiAgICBZQU1MX0ZST05UX01BVFRFUl9SRUdFWCxcclxuICAgIFNJTkdMRUxJTkVfQ0FSRF9SRUdFWCxcclxuICAgIE1VTFRJTElORV9DQVJEX1JFR0VYLFxyXG4gICAgQ0xPWkVfQ0FSRF9ERVRFQ1RPUixcclxuICAgIENMT1pFX0RFTEVUSU9OU19FWFRSQUNUT1IsXHJcbiAgICBDTE9aRV9TQ0hFRFVMSU5HX0VYVFJBQ1RPUixcclxufSBmcm9tIFwiLi9jb25zdGFudHNcIjtcclxuXHJcbmludGVyZmFjZSBQbHVnaW5EYXRhIHtcclxuICAgIHNldHRpbmdzOiBTUlNldHRpbmdzO1xyXG59XHJcblxyXG5jb25zdCBERUZBVUxUX0RBVEE6IFBsdWdpbkRhdGEgPSB7XHJcbiAgICBzZXR0aW5nczogREVGQVVMVF9TRVRUSU5HUyxcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNSUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcclxuICAgIHByaXZhdGUgc3RhdHVzQmFyOiBIVE1MRWxlbWVudDtcclxuICAgIHByaXZhdGUgcmV2aWV3UXVldWVWaWV3OiBSZXZpZXdRdWV1ZUxpc3RWaWV3O1xyXG4gICAgcHVibGljIGRhdGE6IFBsdWdpbkRhdGE7XHJcblxyXG4gICAgcHVibGljIG5ld05vdGVzOiBURmlsZVtdID0gW107XHJcbiAgICBwdWJsaWMgc2NoZWR1bGVkTm90ZXM6IFNjaGVkTm90ZVtdID0gW107XHJcbiAgICBwcml2YXRlIGVhc2VCeVBhdGg6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcclxuICAgIHByaXZhdGUgaW5jb21pbmdMaW5rczogUmVjb3JkPHN0cmluZywgTGlua1N0YXRbXT4gPSB7fTtcclxuICAgIHByaXZhdGUgcGFnZXJhbmtzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XHJcbiAgICBwcml2YXRlIGR1ZU5vdGVzQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgcHVibGljIG5ld0ZsYXNoY2FyZHM6IFJlY29yZDxzdHJpbmcsIENhcmRbXT4gPSB7fTsgLy8gPGRlY2sgbmFtZSwgQ2FyZFtdPlxyXG4gICAgcHVibGljIG5ld0ZsYXNoY2FyZHNDb3VudDogbnVtYmVyID0gMDtcclxuICAgIHB1YmxpYyBkdWVGbGFzaGNhcmRzOiBSZWNvcmQ8c3RyaW5nLCBDYXJkW10+ID0ge307IC8vIDxkZWNrIG5hbWUsIENhcmRbXT5cclxuICAgIHB1YmxpYyBkdWVGbGFzaGNhcmRzQ291bnQ6IG51bWJlciA9IDA7XHJcblxyXG4gICAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZFBsdWdpbkRhdGEoKTtcclxuXHJcbiAgICAgICAgYWRkSWNvbihcImNyb3NzaGFpcnNcIiwgQ1JPU1NfSEFJUlNfSUNPTik7XHJcblxyXG4gICAgICAgIHRoaXMuc3RhdHVzQmFyID0gdGhpcy5hZGRTdGF0dXNCYXJJdGVtKCk7XHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuY2xhc3NMaXN0LmFkZChcIm1vZC1jbGlja2FibGVcIik7XHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBcIk9wZW4gYSBub3RlIGZvciByZXZpZXdcIik7XHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbC1wb3NpdGlvblwiLCBcInRvcFwiKTtcclxuICAgICAgICB0aGlzLnN0YXR1c0Jhci5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKF86IGFueSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnN5bmMoKTtcclxuICAgICAgICAgICAgdGhpcy5yZXZpZXdOZXh0Tm90ZSgpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJjcm9zc2hhaXJzXCIsIFwiUmV2aWV3IGZsYXNoY2FyZHNcIiwgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmZsYXNoY2FyZHNfc3luYygpO1xyXG4gICAgICAgICAgICBuZXcgRmxhc2hjYXJkTW9kYWwodGhpcy5hcHAsIHRoaXMpLm9wZW4oKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5yZWdpc3RlclZpZXcoXHJcbiAgICAgICAgICAgIFJFVklFV19RVUVVRV9WSUVXX1RZUEUsXHJcbiAgICAgICAgICAgIChsZWFmKSA9PlxyXG4gICAgICAgICAgICAgICAgKHRoaXMucmV2aWV3UXVldWVWaWV3ID0gbmV3IFJldmlld1F1ZXVlTGlzdFZpZXcobGVhZiwgdGhpcykpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmRhdGEuc2V0dGluZ3MuZGlzYWJsZUZpbGVNZW51UmV2aWV3T3B0aW9ucykge1xyXG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnUsIGZpbGU6IFRGaWxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uc2V0VGl0bGUoXCJSZXZpZXc6IEVhc3lcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRJY29uKFwiY3Jvc3NoYWlyc1wiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uQ2xpY2soKGV2dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldmlld1Jlc3BvbnNlLkVhc3lcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5zZXRUaXRsZShcIlJldmlldzogR29vZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc2hhaXJzXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAub25DbGljaygoZXZ0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUuZXh0ZW5zaW9uID09IFwibWRcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmV2aWV3UmVzcG9uc2UuR29vZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnNldFRpdGxlKFwiUmV2aWV3OiBIYXJkXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0SWNvbihcImNyb3NzaGFpcnNcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKChldnQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNhdmVSZXZpZXdSZXNwb25zZShcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZXZpZXdSZXNwb25zZS5IYXJkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogXCJub3RlLXJldmlldy1vcGVuLW5vdGVcIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcGVuIGEgbm90ZSBmb3IgcmV2aWV3XCIsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN5bmMoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmV2aWV3TmV4dE5vdGUoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6IFwibm90ZS1yZXZpZXctZWFzeVwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJldmlldyBub3RlIGFzIGVhc3lcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5GaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChvcGVuRmlsZSAmJiBvcGVuRmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKG9wZW5GaWxlLCBSZXZpZXdSZXNwb25zZS5FYXN5KTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6IFwibm90ZS1yZXZpZXctZ29vZFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJldmlldyBub3RlIGFzIGdvb2RcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5GaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChvcGVuRmlsZSAmJiBvcGVuRmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKG9wZW5GaWxlLCBSZXZpZXdSZXNwb25zZS5Hb29kKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6IFwibm90ZS1yZXZpZXctaGFyZFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJldmlldyBub3RlIGFzIGhhcmRcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5GaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChvcGVuRmlsZSAmJiBvcGVuRmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKG9wZW5GaWxlLCBSZXZpZXdSZXNwb25zZS5IYXJkKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTUlNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmluaXRWaWV3KCk7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5zeW5jKCksIDIwMDApO1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZmxhc2hjYXJkc19zeW5jKCksIDIwMDApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIG9udW5sb2FkKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZVxyXG4gICAgICAgICAgICAuZ2V0TGVhdmVzT2ZUeXBlKFJFVklFV19RVUVVRV9WSUVXX1RZUEUpXHJcbiAgICAgICAgICAgIC5mb3JFYWNoKChsZWFmKSA9PiBsZWFmLmRldGFjaCgpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzeW5jKCkge1xyXG4gICAgICAgIGxldCBub3RlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcclxuXHJcbiAgICAgICAgZ3JhcGgucmVzZXQoKTtcclxuICAgICAgICB0aGlzLnNjaGVkdWxlZE5vdGVzID0gW107XHJcbiAgICAgICAgdGhpcy5lYXNlQnlQYXRoID0ge307XHJcbiAgICAgICAgdGhpcy5uZXdOb3RlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuaW5jb21pbmdMaW5rcyA9IHt9O1xyXG4gICAgICAgIHRoaXMucGFnZXJhbmtzID0ge307XHJcbiAgICAgICAgdGhpcy5kdWVOb3Rlc0NvdW50ID0gMDtcclxuXHJcbiAgICAgICAgbGV0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgZm9yIChsZXQgbm90ZSBvZiBub3Rlcykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pbmNvbWluZ0xpbmtzW25vdGUucGF0aF0gPT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0xpbmtzW25vdGUucGF0aF0gPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGxldCBsaW5rcyA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUucmVzb2x2ZWRMaW5rc1tub3RlLnBhdGhdIHx8IHt9O1xyXG4gICAgICAgICAgICBmb3IgKGxldCB0YXJnZXRQYXRoIGluIGxpbmtzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pbmNvbWluZ0xpbmtzW3RhcmdldFBhdGhdID09IHVuZGVmaW5lZClcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nTGlua3NbdGFyZ2V0UGF0aF0gPSBbXTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBtYXJrZG93biBmaWxlcyBvbmx5XHJcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0UGF0aC5zcGxpdChcIi5cIikucG9wKCkudG9Mb3dlckNhc2UoKSA9PSBcIm1kXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nTGlua3NbdGFyZ2V0UGF0aF0ucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGg6IG5vdGUucGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGlua0NvdW50OiBsaW5rc1t0YXJnZXRQYXRoXSxcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZ3JhcGgubGluayhub3RlLnBhdGgsIHRhcmdldFBhdGgsIGxpbmtzW3RhcmdldFBhdGhdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgbGV0IGZpbGVDYWNoZWREYXRhID1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKG5vdGUpIHx8IHt9O1xyXG5cclxuICAgICAgICAgICAgbGV0IGZyb250bWF0dGVyID1cclxuICAgICAgICAgICAgICAgIGZpbGVDYWNoZWREYXRhLmZyb250bWF0dGVyIHx8IDxSZWNvcmQ8c3RyaW5nLCBhbnk+Pnt9O1xyXG4gICAgICAgICAgICBsZXQgdGFncyA9IGdldEFsbFRhZ3MoZmlsZUNhY2hlZERhdGEpIHx8IFtdO1xyXG5cclxuICAgICAgICAgICAgbGV0IHNob3VsZElnbm9yZSA9IHRydWU7XHJcbiAgICAgICAgICAgIGZvciAobGV0IHRhZyBvZiB0YWdzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5pbmNsdWRlcyh0YWcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2hvdWxkSWdub3JlID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgLy8gZmlsZSBoYXMgbm8gc2NoZWR1bGluZyBpbmZvcm1hdGlvblxyXG4gICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICAhKFxyXG4gICAgICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItZHVlXCIpICYmXHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1pbnRlcnZhbFwiKSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItZWFzZVwiKVxyXG4gICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubmV3Tm90ZXMucHVzaChub3RlKTtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgZHVlVW5peDogbnVtYmVyID0gd2luZG93XHJcbiAgICAgICAgICAgICAgICAubW9tZW50KGZyb250bWF0dGVyW1wic3ItZHVlXCJdLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgXCJZWVlZLU1NLUREXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJERC1NTS1ZWVlZXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJkZGQgTU1NIEREIFlZWVlcIixcclxuICAgICAgICAgICAgICAgIF0pXHJcbiAgICAgICAgICAgICAgICAudmFsdWVPZigpO1xyXG4gICAgICAgICAgICB0aGlzLnNjaGVkdWxlZE5vdGVzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgIGR1ZVVuaXgsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5lYXNlQnlQYXRoW25vdGUucGF0aF0gPSBmcm9udG1hdHRlcltcInNyLWVhc2VcIl07XHJcblxyXG4gICAgICAgICAgICBpZiAoZHVlVW5peCA8PSBub3cpIHRoaXMuZHVlTm90ZXNDb3VudCsrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JhcGgucmFuaygwLjg1LCAwLjAwMDAwMSwgKG5vZGU6IHN0cmluZywgcmFuazogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGFnZXJhbmtzW25vZGVdID0gcmFuayAqIDEwMDAwO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBzb3J0IG5ldyBub3RlcyBieSBpbXBvcnRhbmNlXHJcbiAgICAgICAgdGhpcy5uZXdOb3RlcyA9IHRoaXMubmV3Tm90ZXMuc29ydChcclxuICAgICAgICAgICAgKGE6IFRGaWxlLCBiOiBURmlsZSkgPT5cclxuICAgICAgICAgICAgICAgICh0aGlzLnBhZ2VyYW5rc1tiLnBhdGhdIHx8IDApIC0gKHRoaXMucGFnZXJhbmtzW2EucGF0aF0gfHwgMClcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyBzb3J0IHNjaGVkdWxlZCBub3RlcyBieSBkYXRlICYgd2l0aGluIHRob3NlIGRheXMsIHNvcnQgdGhlbSBieSBpbXBvcnRhbmNlXHJcbiAgICAgICAgdGhpcy5zY2hlZHVsZWROb3RlcyA9IHRoaXMuc2NoZWR1bGVkTm90ZXMuc29ydChcclxuICAgICAgICAgICAgKGE6IFNjaGVkTm90ZSwgYjogU2NoZWROb3RlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYS5kdWVVbml4IC0gYi5kdWVVbml4O1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAhPSAwKSByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAodGhpcy5wYWdlcmFua3NbYi5ub3RlLnBhdGhdIHx8IDApIC1cclxuICAgICAgICAgICAgICAgICAgICAodGhpcy5wYWdlcmFua3NbYS5ub3RlLnBhdGhdIHx8IDApXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0VGV4dChcclxuICAgICAgICAgICAgYFJldmlldzogJHt0aGlzLmR1ZU5vdGVzQ291bnR9IG5vdGUocyksICR7dGhpcy5kdWVGbGFzaGNhcmRzQ291bnR9IGNhcmQocykgZHVlYFxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdGhpcy5yZXZpZXdRdWV1ZVZpZXcucmVkcmF3KCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2F2ZVJldmlld1Jlc3BvbnNlKG5vdGU6IFRGaWxlLCByZXNwb25zZTogUmV2aWV3UmVzcG9uc2UpIHtcclxuICAgICAgICBsZXQgZmlsZUNhY2hlZERhdGEgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpbGVDYWNoZShub3RlKSB8fCB7fTtcclxuICAgICAgICBsZXQgZnJvbnRtYXR0ZXIgPSBmaWxlQ2FjaGVkRGF0YS5mcm9udG1hdHRlciB8fCA8UmVjb3JkPHN0cmluZywgYW55Pj57fTtcclxuXHJcbiAgICAgICAgbGV0IHRhZ3MgPSBnZXRBbGxUYWdzKGZpbGVDYWNoZWREYXRhKSB8fCBbXTtcclxuICAgICAgICBsZXQgc2hvdWxkSWdub3JlID0gdHJ1ZTtcclxuICAgICAgICBmb3IgKGxldCB0YWcgb2YgdGFncykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5pbmNsdWRlcyh0YWcpKSB7XHJcbiAgICAgICAgICAgICAgICBzaG91bGRJZ25vcmUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoc2hvdWxkSWdub3JlKSB7XHJcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXHJcbiAgICAgICAgICAgICAgICBcIlBsZWFzZSB0YWcgdGhlIG5vdGUgYXBwcm9wcmlhdGVseSBmb3IgcmV2aWV3aW5nIChpbiBzZXR0aW5ncykuXCJcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZpbGVUZXh0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChub3RlKTtcclxuICAgICAgICBsZXQgZWFzZSwgaW50ZXJ2YWw7XHJcbiAgICAgICAgLy8gbmV3IG5vdGVcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICEoXHJcbiAgICAgICAgICAgICAgICBmcm9udG1hdHRlci5oYXNPd25Qcm9wZXJ0eShcInNyLWR1ZVwiKSAmJlxyXG4gICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1pbnRlcnZhbFwiKSAmJlxyXG4gICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1lYXNlXCIpXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgbGV0IGxpbmtUb3RhbCA9IDAsXHJcbiAgICAgICAgICAgICAgICBsaW5rUEdUb3RhbCA9IDAsXHJcbiAgICAgICAgICAgICAgICB0b3RhbExpbmtDb3VudCA9IDA7XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBzdGF0T2JqIG9mIHRoaXMuaW5jb21pbmdMaW5rc1tub3RlLnBhdGhdKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZWFzZSA9IHRoaXMuZWFzZUJ5UGF0aFtzdGF0T2JqLnNvdXJjZVBhdGhdO1xyXG4gICAgICAgICAgICAgICAgaWYgKGVhc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBsaW5rVG90YWwgKz1cclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdE9iai5saW5rQ291bnQgKlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2VyYW5rc1tzdGF0T2JqLnNvdXJjZVBhdGhdICpcclxuICAgICAgICAgICAgICAgICAgICAgICAgZWFzZTtcclxuICAgICAgICAgICAgICAgICAgICBsaW5rUEdUb3RhbCArPVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2VyYW5rc1tzdGF0T2JqLnNvdXJjZVBhdGhdICogc3RhdE9iai5saW5rQ291bnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgdG90YWxMaW5rQ291bnQgKz0gc3RhdE9iai5saW5rQ291bnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBvdXRnb2luZ0xpbmtzID1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUucmVzb2x2ZWRMaW5rc1tub3RlLnBhdGhdIHx8IHt9O1xyXG4gICAgICAgICAgICBmb3IgKGxldCBsaW5rZWRGaWxlUGF0aCBpbiBvdXRnb2luZ0xpbmtzKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZWFzZSA9IHRoaXMuZWFzZUJ5UGF0aFtsaW5rZWRGaWxlUGF0aF07XHJcbiAgICAgICAgICAgICAgICBpZiAoZWFzZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxpbmtUb3RhbCArPVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRnb2luZ0xpbmtzW2xpbmtlZEZpbGVQYXRoXSAqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZXJhbmtzW2xpbmtlZEZpbGVQYXRoXSAqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVhc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgbGlua1BHVG90YWwgKz1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlcmFua3NbbGlua2VkRmlsZVBhdGhdICpcclxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0Z29pbmdMaW5rc1tsaW5rZWRGaWxlUGF0aF07XHJcbiAgICAgICAgICAgICAgICAgICAgdG90YWxMaW5rQ291bnQgKz0gb3V0Z29pbmdMaW5rc1tsaW5rZWRGaWxlUGF0aF07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCBsaW5rQ29udHJpYnV0aW9uID1cclxuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5zZXR0aW5ncy5tYXhMaW5rRmFjdG9yICpcclxuICAgICAgICAgICAgICAgIE1hdGgubWluKDEuMCwgTWF0aC5sb2codG90YWxMaW5rQ291bnQgKyAwLjUpIC8gTWF0aC5sb2coNjQpKTtcclxuICAgICAgICAgICAgZWFzZSA9IE1hdGgucm91bmQoXHJcbiAgICAgICAgICAgICAgICAoMS4wIC0gbGlua0NvbnRyaWJ1dGlvbikgKiB0aGlzLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2UgK1xyXG4gICAgICAgICAgICAgICAgICAgICh0b3RhbExpbmtDb3VudCA+IDBcclxuICAgICAgICAgICAgICAgICAgICAgICAgPyAobGlua0NvbnRyaWJ1dGlvbiAqIGxpbmtUb3RhbCkgLyBsaW5rUEdUb3RhbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGxpbmtDb250cmlidXRpb24gKiB0aGlzLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2UpXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIGludGVydmFsID0gMTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpbnRlcnZhbCA9IGZyb250bWF0dGVyW1wic3ItaW50ZXJ2YWxcIl07XHJcbiAgICAgICAgICAgIGVhc2UgPSBmcm9udG1hdHRlcltcInNyLWVhc2VcIl07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgc2NoZWRPYmogPSBzY2hlZHVsZShcclxuICAgICAgICAgICAgcmVzcG9uc2UsXHJcbiAgICAgICAgICAgIGludGVydmFsLFxyXG4gICAgICAgICAgICBlYXNlLFxyXG4gICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MubGFwc2VzSW50ZXJ2YWxDaGFuZ2UsXHJcbiAgICAgICAgICAgIHRoaXMuZGF0YS5zZXR0aW5ncy5lYXN5Qm9udXNcclxuICAgICAgICApO1xyXG4gICAgICAgIGludGVydmFsID0gTWF0aC5yb3VuZChzY2hlZE9iai5pbnRlcnZhbCk7XHJcbiAgICAgICAgZWFzZSA9IHNjaGVkT2JqLmVhc2U7XHJcblxyXG4gICAgICAgIGxldCBkdWUgPSB3aW5kb3cubW9tZW50KERhdGUubm93KCkgKyBpbnRlcnZhbCAqIDI0ICogMzYwMCAqIDEwMDApO1xyXG4gICAgICAgIGxldCBkdWVTdHJpbmcgPSBkdWUuZm9ybWF0KFwiWVlZWS1NTS1ERFwiKTtcclxuXHJcbiAgICAgICAgLy8gY2hlY2sgaWYgc2NoZWR1bGluZyBpbmZvIGV4aXN0c1xyXG4gICAgICAgIGlmIChTQ0hFRFVMSU5HX0lORk9fUkVHRVgudGVzdChmaWxlVGV4dCkpIHtcclxuICAgICAgICAgICAgbGV0IHNjaGVkdWxpbmdJbmZvID0gU0NIRURVTElOR19JTkZPX1JFR0VYLmV4ZWMoZmlsZVRleHQpO1xyXG4gICAgICAgICAgICBmaWxlVGV4dCA9IGZpbGVUZXh0LnJlcGxhY2UoXHJcbiAgICAgICAgICAgICAgICBTQ0hFRFVMSU5HX0lORk9fUkVHRVgsXHJcbiAgICAgICAgICAgICAgICBgLS0tXFxuJHtzY2hlZHVsaW5nSW5mb1sxXX1zci1kdWU6ICR7ZHVlU3RyaW5nfVxcbnNyLWludGVydmFsOiAke2ludGVydmFsfVxcbnNyLWVhc2U6ICR7ZWFzZX1cXG4ke3NjaGVkdWxpbmdJbmZvWzVdfS0tLWBcclxuICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgIC8vIG5ldyBub3RlIHdpdGggZXhpc3RpbmcgWUFNTCBmcm9udCBtYXR0ZXJcclxuICAgICAgICB9IGVsc2UgaWYgKFlBTUxfRlJPTlRfTUFUVEVSX1JFR0VYLnRlc3QoZmlsZVRleHQpKSB7XHJcbiAgICAgICAgICAgIGxldCBleGlzdGluZ1lhbWwgPSBZQU1MX0ZST05UX01BVFRFUl9SRUdFWC5leGVjKGZpbGVUZXh0KTtcclxuICAgICAgICAgICAgZmlsZVRleHQgPSBmaWxlVGV4dC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAgICAgWUFNTF9GUk9OVF9NQVRURVJfUkVHRVgsXHJcbiAgICAgICAgICAgICAgICBgLS0tXFxuJHtleGlzdGluZ1lhbWxbMV19c3ItZHVlOiAke2R1ZVN0cmluZ31cXG5zci1pbnRlcnZhbDogJHtpbnRlcnZhbH1cXG5zci1lYXNlOiAke2Vhc2V9XFxuLS0tYFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZpbGVUZXh0ID0gYC0tLVxcbnNyLWR1ZTogJHtkdWVTdHJpbmd9XFxuc3ItaW50ZXJ2YWw6ICR7aW50ZXJ2YWx9XFxuc3ItZWFzZTogJHtlYXNlfVxcbi0tLVxcblxcbiR7ZmlsZVRleHR9YDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShub3RlLCBmaWxlVGV4dCk7XHJcblxyXG4gICAgICAgIG5ldyBOb3RpY2UoXCJSZXNwb25zZSByZWNlaXZlZC5cIik7XHJcblxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnN5bmMoKTtcclxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5zZXR0aW5ncy5hdXRvTmV4dE5vdGUpIHRoaXMucmV2aWV3TmV4dE5vdGUoKTtcclxuICAgICAgICB9LCA1MDApO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHJldmlld05leHROb3RlKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmR1ZU5vdGVzQ291bnQgPiAwKSB7XHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZGF0YS5zZXR0aW5ncy5vcGVuUmFuZG9tTm90ZVxyXG4gICAgICAgICAgICAgICAgPyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLmR1ZU5vdGVzQ291bnQpXHJcbiAgICAgICAgICAgICAgICA6IDA7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLm9wZW5GaWxlKFxyXG4gICAgICAgICAgICAgICAgdGhpcy5zY2hlZHVsZWROb3Rlc1tpbmRleF0ubm90ZVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5uZXdOb3Rlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZGF0YS5zZXR0aW5ncy5vcGVuUmFuZG9tTm90ZVxyXG4gICAgICAgICAgICAgICAgPyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLm5ld05vdGVzLmxlbmd0aClcclxuICAgICAgICAgICAgICAgIDogMDtcclxuICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmFjdGl2ZUxlYWYub3BlbkZpbGUodGhpcy5uZXdOb3Rlc1tpbmRleF0pO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBuZXcgTm90aWNlKFwiWW91J3JlIGRvbmUgZm9yIHRoZSBkYXkgOkQuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGZsYXNoY2FyZHNfc3luYygpIHtcclxuICAgICAgICBsZXQgbm90ZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XHJcblxyXG4gICAgICAgIHRoaXMubmV3Rmxhc2hjYXJkcyA9IHt9O1xyXG4gICAgICAgIHRoaXMubmV3Rmxhc2hjYXJkc0NvdW50ID0gMDtcclxuICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHMgPSB7fTtcclxuICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHNDb3VudCA9IDA7XHJcblxyXG4gICAgICAgIGZvciAobGV0IG5vdGUgb2Ygbm90ZXMpIHtcclxuICAgICAgICAgICAgbGV0IGZpbGVDYWNoZWREYXRhID1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKG5vdGUpIHx8IHt9O1xyXG4gICAgICAgICAgICBsZXQgZnJvbnRtYXR0ZXIgPVxyXG4gICAgICAgICAgICAgICAgZmlsZUNhY2hlZERhdGEuZnJvbnRtYXR0ZXIgfHwgPFJlY29yZDxzdHJpbmcsIGFueT4+e307XHJcbiAgICAgICAgICAgIGxldCB0YWdzID0gZ2V0QWxsVGFncyhmaWxlQ2FjaGVkRGF0YSkgfHwgW107XHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCB0YWcgb2YgdGFncykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5zZXR0aW5ncy5mbGFzaGNhcmRUYWdzLmluY2x1ZGVzKHRhZykpIHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmZpbmRGbGFzaGNhcmRzKG5vdGUsIHRhZyk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHNvcnQgdGhlIGRlY2sgbmFtZXNcclxuICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHMgPSBPYmplY3Qua2V5cyh0aGlzLmR1ZUZsYXNoY2FyZHMpXHJcbiAgICAgICAgICAgIC5zb3J0KClcclxuICAgICAgICAgICAgLnJlZHVjZSgob2JqOiBSZWNvcmQ8c3RyaW5nLCBDYXJkW10+LCBrZXk6IHN0cmluZykgPT4ge1xyXG4gICAgICAgICAgICAgICAgb2JqW2tleV0gPSB0aGlzLmR1ZUZsYXNoY2FyZHNba2V5XTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XHJcbiAgICAgICAgICAgIH0sIHt9KTtcclxuICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHMgPSBPYmplY3Qua2V5cyh0aGlzLm5ld0ZsYXNoY2FyZHMpXHJcbiAgICAgICAgICAgIC5zb3J0KClcclxuICAgICAgICAgICAgLnJlZHVjZSgob2JqOiBSZWNvcmQ8c3RyaW5nLCBDYXJkW10+LCBrZXk6IHN0cmluZykgPT4ge1xyXG4gICAgICAgICAgICAgICAgb2JqW2tleV0gPSB0aGlzLm5ld0ZsYXNoY2FyZHNba2V5XTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvYmo7XHJcbiAgICAgICAgICAgIH0sIHt9KTtcclxuXHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0VGV4dChcclxuICAgICAgICAgICAgYFJldmlldzogJHt0aGlzLmR1ZU5vdGVzQ291bnR9IG5vdGUocyksICR7dGhpcy5kdWVGbGFzaGNhcmRzQ291bnR9IGNhcmQocykgZHVlYFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZmluZEZsYXNoY2FyZHMobm90ZTogVEZpbGUsIGRlY2s6IHN0cmluZykge1xyXG4gICAgICAgIGxldCBmaWxlVGV4dCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQobm90ZSk7XHJcbiAgICAgICAgbGV0IGZpbGVDYWNoZWREYXRhID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUobm90ZSkgfHwge307XHJcbiAgICAgICAgbGV0IGhlYWRpbmdzID0gZmlsZUNhY2hlZERhdGEuaGVhZGluZ3MgfHwgW107XHJcbiAgICAgICAgbGV0IGZpbGVDaGFuZ2VkID0gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5kdWVGbGFzaGNhcmRzLmhhc093blByb3BlcnR5KGRlY2spKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHVlRmxhc2hjYXJkc1tkZWNrXSA9IFtdO1xyXG4gICAgICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHNbZGVja10gPSBbXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgICAgIC8vIGJhc2ljIGNhcmRzXHJcbiAgICAgICAgZm9yIChsZXQgcmVnZXggb2YgW1NJTkdMRUxJTkVfQ0FSRF9SRUdFWCwgTVVMVElMSU5FX0NBUkRfUkVHRVhdKSB7XHJcbiAgICAgICAgICAgIGxldCBjYXJkVHlwZTogQ2FyZFR5cGUgPVxyXG4gICAgICAgICAgICAgICAgcmVnZXggPT0gU0lOR0xFTElORV9DQVJEX1JFR0VYXHJcbiAgICAgICAgICAgICAgICAgICAgPyBDYXJkVHlwZS5TaW5nbGVMaW5lQmFzaWNcclxuICAgICAgICAgICAgICAgICAgICA6IENhcmRUeXBlLk11bHRpTGluZUJhc2ljO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBtYXRjaCBvZiBmaWxlVGV4dC5tYXRjaEFsbChyZWdleCkpIHtcclxuICAgICAgICAgICAgICAgIG1hdGNoWzBdID0gbWF0Y2hbMF0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgbWF0Y2hbMV0gPSBtYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBtYXRjaFsyXSA9IG1hdGNoWzJdLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgIGxldCBjYXJkT2JqOiBDYXJkO1xyXG4gICAgICAgICAgICAgICAgLy8gZmxhc2hjYXJkIGFscmVhZHkgc2NoZWR1bGVkXHJcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hbM10pIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZHVlVW5peDogbnVtYmVyID0gd2luZG93XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tb21lbnQobWF0Y2hbM10sIFtcIllZWVktTU0tRERcIiwgXCJERC1NTS1ZWVlZXCIsIFwiZGRkIE1NTSBERCBZWVlZXCJdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAudmFsdWVPZigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkdWVVbml4IDw9IG5vdykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkT2JqID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNEdWU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbDogcGFyc2VJbnQobWF0Y2hbNF0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWFzZTogcGFyc2VJbnQobWF0Y2hbNV0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb250OiBtYXRjaFsxXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2s6IG1hdGNoWzJdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQ6IG1hdGNoWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dDogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhcmRUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHNbZGVja10ucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kdWVGbGFzaGNhcmRzQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRPYmogPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRHVlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbnQ6IG1hdGNoWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBiYWNrOiBtYXRjaFsyXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQ6IG1hdGNoWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkVHlwZSxcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmV3Rmxhc2hjYXJkc1tkZWNrXS5wdXNoKGNhcmRPYmopO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmV3Rmxhc2hjYXJkc0NvdW50Kys7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgYWRkQ29udGV4dFRvQ2FyZChjYXJkT2JqLCBtYXRjaC5pbmRleCwgaGVhZGluZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBjbG96ZSBkZWxldGlvbiBjYXJkc1xyXG4gICAgICAgIGZvciAobGV0IG1hdGNoIG9mIGZpbGVUZXh0Lm1hdGNoQWxsKENMT1pFX0NBUkRfREVURUNUT1IpKSB7XHJcbiAgICAgICAgICAgIG1hdGNoWzBdID0gbWF0Y2hbMF0udHJpbSgpO1xyXG5cclxuICAgICAgICAgICAgbGV0IGNhcmRUZXh0ID0gbWF0Y2hbMF07XHJcbiAgICAgICAgICAgIGxldCBkZWxldGlvbnMgPSBbLi4uY2FyZFRleHQubWF0Y2hBbGwoQ0xPWkVfREVMRVRJT05TX0VYVFJBQ1RPUildO1xyXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGluZyA9IFsuLi5jYXJkVGV4dC5tYXRjaEFsbChDTE9aRV9TQ0hFRFVMSU5HX0VYVFJBQ1RPUildO1xyXG5cclxuICAgICAgICAgICAgLy8gd2UgaGF2ZSBzb21lIGV4dHJhIHNjaGVkdWxpbmcgZGF0ZXMgdG8gZGVsZXRlXHJcbiAgICAgICAgICAgIGlmIChzY2hlZHVsaW5nLmxlbmd0aCA+IGRlbGV0aW9ucy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIGxldCBpZHhTY2hlZCA9IGNhcmRUZXh0Lmxhc3RJbmRleE9mKFwiPCEtLVNSOlwiKSArIDc7XHJcbiAgICAgICAgICAgICAgICBsZXQgbmV3Q2FyZFRleHQgPSBjYXJkVGV4dC5zdWJzdHJpbmcoMCwgaWR4U2NoZWQpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWxldGlvbnMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3Q2FyZFRleHQgKz0gYCEke3NjaGVkdWxpbmdbaV1bMV19LCR7c2NoZWR1bGluZ1tpXVsyXX0sJHtzY2hlZHVsaW5nW2ldWzNdfWA7XHJcbiAgICAgICAgICAgICAgICBuZXdDYXJkVGV4dCArPSBcIi0tPlxcblwiO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCByZXBsYWNlbWVudFJlZ2V4ID0gbmV3IFJlZ0V4cChcclxuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIiksIC8vIGVzY2FwZSBzdHJpbmdcclxuICAgICAgICAgICAgICAgICAgICBcImdtXCJcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICBmaWxlVGV4dCA9IGZpbGVUZXh0LnJlcGxhY2UocmVwbGFjZW1lbnRSZWdleCwgbmV3Q2FyZFRleHQpO1xyXG4gICAgICAgICAgICAgICAgZmlsZUNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgcmVsYXRlZENhcmRzOiBDYXJkW10gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWxldGlvbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBjYXJkT2JqOiBDYXJkO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBkZWxldGlvblN0YXJ0ID0gZGVsZXRpb25zW2ldLmluZGV4O1xyXG4gICAgICAgICAgICAgICAgbGV0IGRlbGV0aW9uRW5kID0gZGVsZXRpb25TdGFydCArIGRlbGV0aW9uc1tpXVswXS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbnQgPVxyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0LnN1YnN0cmluZygwLCBkZWxldGlvblN0YXJ0KSArXHJcbiAgICAgICAgICAgICAgICAgICAgXCI8c3BhbiBzdHlsZT0nY29sb3I6IzIxOTZmMyc+Wy4uLl08L3NwYW4+XCIgK1xyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0LnN1YnN0cmluZyhkZWxldGlvbkVuZCk7XHJcbiAgICAgICAgICAgICAgICBmcm9udCA9IGZyb250LnJlcGxhY2UoLz09L2dtLCBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGxldCBiYWNrID1cclxuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dC5zdWJzdHJpbmcoMCwgZGVsZXRpb25TdGFydCkgK1xyXG4gICAgICAgICAgICAgICAgICAgIFwiPHNwYW4gc3R5bGU9J2NvbG9yOiMyMTk2ZjMnPlwiICtcclxuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dC5zdWJzdHJpbmcoZGVsZXRpb25TdGFydCwgZGVsZXRpb25FbmQpICtcclxuICAgICAgICAgICAgICAgICAgICBcIjwvc3Bhbj5cIiArXHJcbiAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQuc3Vic3RyaW5nKGRlbGV0aW9uRW5kKTtcclxuICAgICAgICAgICAgICAgIGJhY2sgPSBiYWNrLnJlcGxhY2UoLz09L2dtLCBcIlwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBjYXJkIGRlbGV0aW9uIHNjaGVkdWxlZFxyXG4gICAgICAgICAgICAgICAgaWYgKGkgPCBzY2hlZHVsaW5nLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBkdWVVbml4OiBudW1iZXIgPSB3aW5kb3dcclxuICAgICAgICAgICAgICAgICAgICAgICAgLm1vbWVudChzY2hlZHVsaW5nW2ldWzFdLCBbXCJZWVlZLU1NLUREXCIsIFwiREQtTU0tWVlZWVwiXSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnZhbHVlT2YoKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZHVlVW5peCA8PSBub3cpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FyZE9iaiA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRHVlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWw6IHBhcnNlSW50KHNjaGVkdWxpbmdbaV1bMl0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWFzZTogcGFyc2VJbnQoc2NoZWR1bGluZ1tpXVszXSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3RlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQ6IG1hdGNoWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dDogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhcmRUeXBlOiBDYXJkVHlwZS5DbG96ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YkNhcmRJZHg6IGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWxhdGVkQ2FyZHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHNbZGVja10ucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kdWVGbGFzaGNhcmRzQ291bnQrKztcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIG5ldyBjYXJkXHJcbiAgICAgICAgICAgICAgICAgICAgY2FyZE9iaiA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNEdWU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBub3RlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmcm9udCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYmFjayxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQ6IG1hdGNoWzBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkVHlwZTogQ2FyZFR5cGUuQ2xvemUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YkNhcmRJZHg6IGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkcyxcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHNbZGVja10ucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHNDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkcy5wdXNoKGNhcmRPYmopO1xyXG4gICAgICAgICAgICAgICAgYWRkQ29udGV4dFRvQ2FyZChjYXJkT2JqLCBtYXRjaC5pbmRleCwgaGVhZGluZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZmlsZUNoYW5nZWQpIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShub3RlLCBmaWxlVGV4dCk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgbG9hZFBsdWdpbkRhdGEoKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9EQVRBLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xyXG5cclxuICAgICAgICAvLyBtaXNiZWhhdmluZyBzZXR0aW5nc1xyXG4gICAgICAgIC8vIGFmdGVyIGNoYW5nZXMgdG8gZmxhc2hjYXJkVGFncywgc2F2ZSB0aGUgc2V0dGluZyB0aGUgdXNlciBhbHJlYWR5IGhhc1xyXG4gICAgICAgIC8vIHJlbW92ZSBpbiBmdXR1cmUgKFNheSwgMTV0aCBKdW5lIDIwMjEpXHJcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5zZXR0aW5ncy5mbGFzaGNhcmRUYWdzID09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkVGFncyA9IFtcclxuICAgICAgICAgICAgICAgIC8vQHRzLWlnbm9yZVxyXG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLnNldHRpbmdzLmZsYXNoY2FyZHNUYWcsXHJcbiAgICAgICAgICAgIF07XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZVBsdWdpbkRhdGEoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2F2ZVBsdWdpbkRhdGEoKSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLmRhdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIGluaXRWaWV3KCkge1xyXG4gICAgICAgIGlmICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFJFVklFV19RVUVVRV9WSUVXX1RZUEUpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKS5zZXRWaWV3U3RhdGUoe1xyXG4gICAgICAgICAgICB0eXBlOiBSRVZJRVdfUVVFVUVfVklFV19UWVBFLFxyXG4gICAgICAgICAgICBhY3RpdmU6IHRydWUsXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZENvbnRleHRUb0NhcmQoXHJcbiAgICBjYXJkT2JqOiBDYXJkLFxyXG4gICAgY2FyZE9mZnNldDogbnVtYmVyLFxyXG4gICAgaGVhZGluZ3M6IEhlYWRpbmdDYWNoZVtdXHJcbikge1xyXG4gICAgbGV0IHN0YWNrOiBIZWFkaW5nQ2FjaGVbXSA9IFtdO1xyXG4gICAgZm9yIChsZXQgaGVhZGluZyBvZiBoZWFkaW5ncykge1xyXG4gICAgICAgIGlmIChoZWFkaW5nLnBvc2l0aW9uLnN0YXJ0Lm9mZnNldCA+IGNhcmRPZmZzZXQpIGJyZWFrO1xyXG5cclxuICAgICAgICB3aGlsZSAoXHJcbiAgICAgICAgICAgIHN0YWNrLmxlbmd0aCA+IDAgJiZcclxuICAgICAgICAgICAgc3RhY2tbc3RhY2subGVuZ3RoIC0gMV0ubGV2ZWwgPj0gaGVhZGluZy5sZXZlbFxyXG4gICAgICAgIClcclxuICAgICAgICAgICAgc3RhY2sucG9wKCk7XHJcblxyXG4gICAgICAgIHN0YWNrLnB1c2goaGVhZGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChsZXQgaGVhZGluZ09iaiBvZiBzdGFjaykgY2FyZE9iai5jb250ZXh0ICs9IGhlYWRpbmdPYmouaGVhZGluZyArIFwiID4gXCI7XHJcbiAgICBjYXJkT2JqLmNvbnRleHQgPSBjYXJkT2JqLmNvbnRleHQuc2xpY2UoMCwgLTMpO1xyXG59XHJcbiJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk5vdGljZSIsIk1vZGFsIiwiUGxhdGZvcm0iLCJNYXJrZG93blJlbmRlcmVyIiwiSXRlbVZpZXciLCJNZW51IiwiUGx1Z2luIiwiYWRkSWNvbiIsImdyYXBoLnJlc2V0IiwiZ3JhcGgubGluayIsImdldEFsbFRhZ3MiLCJncmFwaC5yYW5rIl0sIm1hcHBpbmdzIjoiOzs7O0FBRUEsU0FBUyxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUNsQyxJQUFJLElBQUksQ0FBQyxPQUFPLE1BQU0sS0FBSyxRQUFRLE1BQU0sT0FBTyxRQUFRLEtBQUssVUFBVSxDQUFDLEVBQUU7QUFDMUUsUUFBUSxLQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sRUFBRTtBQUNoQyxZQUFZLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUU7QUFDckQsZ0JBQWdCLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUU7QUFDMUQsb0JBQW9CLE1BQU07QUFDMUIsaUJBQWlCO0FBQ2pCLGFBQWE7QUFDYixTQUFTO0FBQ1QsS0FBSztBQUNMLENBQUM7QUFDRDtBQUNBLE9BQWMsR0FBRyxDQUFDLFlBQVk7QUFDOUIsSUFBSSxJQUFJLElBQUksR0FBRztBQUNmLFFBQVEsS0FBSyxFQUFFLENBQUM7QUFDaEIsUUFBUSxLQUFLLEVBQUUsRUFBRTtBQUNqQixRQUFRLEtBQUssRUFBRSxFQUFFO0FBQ2pCLEtBQUssQ0FBQztBQUNOO0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFDbEQsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxNQUFNLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDOUQsWUFBWSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLFNBQVM7QUFD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
