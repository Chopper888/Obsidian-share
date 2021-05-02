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
    flashcardsTag: "#flashcards",
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
            .setName("Flashcards tag")
            .setDesc("Enter one tag i.e. #flashcards.")
            .addText((text) => text
            .setValue(`${this.plugin.data.settings.flashcardsTag}`)
            .onChange(async (value) => {
            this.plugin.data.settings.flashcardsTag = value;
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

const SCHEDULING_INFO_REGEX = /^---\n((?:.*\n)*)sr-due: (.+)\nsr-interval: (\d+)\nsr-ease: (\d+)\n((?:.*\n)*)---/;
const YAML_FRONT_MATTER_REGEX = /^---\n((?:.*\n)*)---/;
const SINGLELINE_CARD_REGEX = /^(.+)::(.+?)\n?(?:<!--SR:(.+),(\d+),(\d+)-->|$)/gm;
const MULTILINE_CARD_REGEX = /^((?:.+\n)+)\?\n((?:.+\n)+?)(?:<!--SR:(.+),(\d+),(\d+)-->|$)/gm;
const CLOZE_CARD_DETECTOR = /(?:.+\n)*^.*?==.*?==.*\n(?:.+\n?)*/gm; // card must have at least one cloze
const CLOZE_DELETIONS_EXTRACTOR = /==(.*?)==/gm;
const CLOZE_SCHEDULING_EXTRACTOR = /!([\d-]+),(\d+),(\d+)/gm;
const CROSS_HAIRS_ICON = `<path style=" stroke:none;fill-rule:nonzero;fill:currentColor;fill-opacity:1;" d="M 99.921875 47.941406 L 93.074219 47.941406 C 92.84375 42.03125 91.390625 36.238281 88.800781 30.921875 L 85.367188 32.582031 C 87.667969 37.355469 88.964844 42.550781 89.183594 47.84375 L 82.238281 47.84375 C 82.097656 44.617188 81.589844 41.417969 80.734375 38.304688 L 77.050781 39.335938 C 77.808594 42.089844 78.261719 44.917969 78.40625 47.769531 L 65.871094 47.769531 C 64.914062 40.507812 59.144531 34.832031 51.871094 33.996094 L 51.871094 21.386719 C 54.816406 21.507812 57.742188 21.960938 60.585938 22.738281 L 61.617188 19.058594 C 58.4375 18.191406 55.164062 17.691406 51.871094 17.570312 L 51.871094 10.550781 C 57.164062 10.769531 62.355469 12.066406 67.132812 14.363281 L 68.789062 10.929688 C 63.5 8.382812 57.738281 6.953125 51.871094 6.734375 L 51.871094 0.0390625 L 48.054688 0.0390625 L 48.054688 6.734375 C 42.179688 6.976562 36.417969 8.433594 31.132812 11.007812 L 32.792969 14.441406 C 37.566406 12.140625 42.761719 10.84375 48.054688 10.625 L 48.054688 17.570312 C 44.828125 17.714844 41.628906 18.21875 38.515625 19.078125 L 39.546875 22.757812 C 42.324219 21.988281 45.175781 21.53125 48.054688 21.386719 L 48.054688 34.03125 C 40.796875 34.949219 35.089844 40.679688 34.203125 47.941406 L 21.5 47.941406 C 21.632812 45.042969 22.089844 42.171875 22.855469 39.375 L 19.171875 38.34375 C 18.3125 41.457031 17.808594 44.65625 17.664062 47.882812 L 10.664062 47.882812 C 10.882812 42.589844 12.179688 37.394531 14.480469 32.621094 L 11.121094 30.921875 C 8.535156 36.238281 7.078125 42.03125 6.847656 47.941406 L 0 47.941406 L 0 51.753906 L 6.847656 51.753906 C 7.089844 57.636719 8.542969 63.402344 11.121094 68.695312 L 14.554688 67.035156 C 12.257812 62.261719 10.957031 57.066406 10.738281 51.773438 L 17.742188 51.773438 C 17.855469 55.042969 18.34375 58.289062 19.191406 61.445312 L 22.871094 60.414062 C 22.089844 57.5625 21.628906 54.632812 21.5 51.679688 L 34.203125 51.679688 C 35.058594 58.96875 40.773438 64.738281 48.054688 65.660156 L 48.054688 78.308594 C 45.105469 78.1875 42.183594 77.730469 39.335938 76.957031 L 38.304688 80.636719 C 41.488281 81.511719 44.757812 82.015625 48.054688 82.144531 L 48.054688 89.144531 C 42.761719 88.925781 37.566406 87.628906 32.792969 85.328125 L 31.132812 88.765625 C 36.425781 91.3125 42.183594 92.742188 48.054688 92.960938 L 48.054688 99.960938 L 51.871094 99.960938 L 51.871094 92.960938 C 57.75 92.71875 63.519531 91.265625 68.808594 88.6875 L 67.132812 85.253906 C 62.355469 87.550781 57.164062 88.851562 51.871094 89.070312 L 51.871094 82.125 C 55.09375 81.980469 58.292969 81.476562 61.40625 80.617188 L 60.378906 76.9375 C 57.574219 77.703125 54.695312 78.15625 51.792969 78.289062 L 51.792969 65.679688 C 59.121094 64.828125 64.910156 59.0625 65.796875 51.734375 L 78.367188 51.734375 C 78.25 54.734375 77.789062 57.710938 76.992188 60.605469 L 80.675781 61.636719 C 81.558594 58.40625 82.066406 55.082031 82.183594 51.734375 L 89.261719 51.734375 C 89.042969 57.03125 87.742188 62.222656 85.445312 66.996094 L 88.878906 68.65625 C 91.457031 63.367188 92.910156 57.597656 93.152344 51.71875 L 100 51.71875 Z M 62.019531 51.734375 C 61.183594 56.945312 57.085938 61.023438 51.871094 61.828125 L 51.871094 57.515625 L 48.054688 57.515625 L 48.054688 61.808594 C 42.910156 60.949219 38.886719 56.902344 38.058594 51.753906 L 42.332031 51.753906 L 42.332031 47.941406 L 38.058594 47.941406 C 38.886719 42.789062 42.910156 38.746094 48.054688 37.886719 L 48.054688 42.179688 L 51.871094 42.179688 L 51.871094 37.847656 C 57.078125 38.648438 61.179688 42.71875 62.019531 47.921875 L 57.707031 47.921875 L 57.707031 51.734375 Z M 62.019531 51.734375 "/>`;
const COLLAPSE_ICON = `<svg viewBox="0 0 100 100" width="8" height="8" class="right-triangle"><path fill="currentColor" stroke="currentColor" d="M94.9,20.8c-1.4-2.5-4.1-4.1-7.1-4.1H12.2c-3,0-5.7,1.6-7.1,4.1c-1.3,2.4-1.2,5.2,0.2,7.6L43.1,88c1.5,2.3,4,3.7,6.9,3.7 s5.4-1.4,6.9-3.7l37.8-59.6C96.1,26,96.2,23.2,94.9,20.8L94.9,20.8z"></path></svg>`;

var UserResponse;
(function (UserResponse) {
    UserResponse[UserResponse["ShowAnswer"] = 0] = "ShowAnswer";
    UserResponse[UserResponse["ReviewHard"] = 1] = "ReviewHard";
    UserResponse[UserResponse["ReviewGood"] = 2] = "ReviewGood";
    UserResponse[UserResponse["ReviewEasy"] = 3] = "ReviewEasy";
    UserResponse[UserResponse["ResetCardProgress"] = 4] = "ResetCardProgress";
    UserResponse[UserResponse["Skip"] = 5] = "Skip";
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
        this.resetLinkView = createDiv("sr-link");
        this.resetLinkView.setText("Reset card's progress");
        this.resetLinkView.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ResetCardProgress);
        });
        this.resetLinkView.style.float = "right";
        this.contentEl.appendChild(this.resetLinkView);
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
                else if (e.code == "Numpad0" || e.code == "Digit0")
                    this.processResponse(UserResponse.ResetCardProgress);
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
        this.resetLinkView.style.display = "none";
        let count = this.plugin.newFlashcards.length + this.plugin.dueFlashcards.length;
        this.titleEl.setText(`Queue - ${count}`);
        if (count == 0) {
            this.answerBtn.style.display = "none";
            this.fileLinkView.innerHTML = "";
            this.resetLinkView.innerHTML = "";
            this.contextView.innerHTML = "";
            this.flashcardView.innerHTML =
                "<h3 style='text-align: center; margin-top: 45%;'>You're done for the day :D.</h3>";
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
            if (this.currentCard.isDue)
                this.resetLinkView.style.display = "inline-block";
            if (!this.currentCard.isCloze) {
                let hr = document.createElement("hr");
                hr.setAttribute("id", "sr-hr-card-divide");
                this.flashcardView.appendChild(hr);
            }
            else
                this.flashcardView.innerHTML = "";
            obsidian.MarkdownRenderer.renderMarkdown(this.currentCard.back, this.flashcardView, this.currentCard.note.path, this.plugin);
        }
        else if (response == UserResponse.ReviewHard ||
            response == UserResponse.ReviewGood ||
            response == UserResponse.ReviewEasy ||
            response == UserResponse.ResetCardProgress) {
            let intervalOuter, easeOuter, due;
            if (response != UserResponse.ResetCardProgress) {
                // scheduled card
                if (this.currentCard.isDue) {
                    this.plugin.dueFlashcards.splice(0, 1);
                    let { interval, ease } = this.nextState(response, this.currentCard.interval, this.currentCard.ease);
                    // don't look too closely lol
                    intervalOuter = interval;
                    easeOuter = ease;
                }
                else {
                    let { interval, ease } = this.nextState(response, 1, this.plugin.data.settings.baseEase);
                    this.plugin.newFlashcards.splice(0, 1);
                    // don't look too closely lol
                    intervalOuter = interval;
                    easeOuter = ease;
                }
                // fuzz
                if (intervalOuter >= 8) {
                    let fuzz = [-0.05 * intervalOuter, 0, 0.05 * intervalOuter];
                    intervalOuter +=
                        fuzz[Math.floor(Math.random() * fuzz.length)];
                }
                intervalOuter = Math.round(intervalOuter);
                due = window.moment(Date.now() + intervalOuter * 24 * 3600 * 1000);
            }
            else {
                intervalOuter = 1.0;
                easeOuter = this.plugin.data.settings.baseEase;
                this.plugin.dueFlashcards.splice(0, 1);
                this.plugin.dueFlashcards.push(this.currentCard);
                due = window.moment(Date.now());
                new obsidian.Notice("Card's progress has been reset");
            }
            let dueString = due.format("DD-MM-YYYY");
            let fileText = await this.app.vault.read(this.currentCard.note);
            let replacementRegex = new RegExp(this.currentCard.match[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), // escape string
            "gm");
            if (this.currentCard.isCloze) {
                let cardText = this.currentCard.match[0];
                let schedIdx = cardText.lastIndexOf("<!--SR:");
                if (schedIdx == -1) {
                    // first time adding scheduling information to flashcard
                    cardText = `${cardText}\n<!--SR:!${dueString},${intervalOuter},${easeOuter}-->`;
                }
                else {
                    let scheduling = [
                        ...cardText.matchAll(CLOZE_SCHEDULING_EXTRACTOR),
                    ];
                    let deletionSched = [
                        "0",
                        dueString,
                        `${intervalOuter}`,
                        `${easeOuter}`,
                    ];
                    if (this.currentCard.isDue)
                        scheduling[this.currentCard.clozeDeletionIdx] = deletionSched;
                    else
                        scheduling.push(deletionSched);
                    cardText = cardText.replace(/<!--SR:.+-->/gm, "");
                    cardText += "<!--SR:";
                    for (let i = 0; i < scheduling.length; i++)
                        cardText += `!${scheduling[i][1]},${scheduling[i][2]},${scheduling[i][3]}`;
                    cardText += "-->";
                }
                fileText = fileText.replace(replacementRegex, cardText);
                for (let relatedCard of this.currentCard.relatedCards)
                    relatedCard.match[0] = cardText;
                if (this.plugin.data.settings.buryRelatedCards)
                    this.buryRelatedCards(this.currentCard.relatedCards);
            }
            else {
                if (this.currentCard.isSingleLine) {
                    let sep = this.plugin.data.settings
                        .singleLineCommentOnSameLine
                        ? " "
                        : "\n";
                    fileText = fileText.replace(replacementRegex, `${this.currentCard.front}::${this.currentCard.back}${sep}<!--SR:${dueString},${intervalOuter},${easeOuter}-->`);
                }
                else {
                    fileText = fileText.replace(replacementRegex, `${this.currentCard.front}\n?\n${this.currentCard.back}\n<!--SR:${dueString},${intervalOuter},${easeOuter}-->`);
                }
            }
            await this.app.vault.modify(this.currentCard.note, fileText);
            this.nextCard();
        }
        else if (response == UserResponse.Skip) {
            if (this.currentCard.isDue)
                this.plugin.dueFlashcards.splice(0, 1);
            else
                this.plugin.newFlashcards.splice(0, 1);
            if (this.currentCard.isCloze)
                this.buryRelatedCards(this.currentCard.relatedCards);
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
            interval =
                (this.plugin.data.settings.easyBonus * interval * ease) / 100;
        return { ease, interval: Math.round(interval * 10) / 10 };
    }
    buryRelatedCards(arr) {
        for (let relatedCard of arr) {
            let dueIdx = this.plugin.dueFlashcards.indexOf(relatedCard);
            let newIdx = this.plugin.newFlashcards.indexOf(relatedCard);
            if (dueIdx != -1)
                this.plugin.dueFlashcards.splice(dueIdx, 1);
            else if (newIdx != -1)
                this.plugin.newFlashcards.splice(newIdx, 1);
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
            let dueUnix = window
                .moment(frontmatter["sr-due"], [
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
        this.statusBar.setText(`Review: ${this.dueNotesCount} notes, ${this.dueFlashcards.length} cards due`);
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
            interval = (this.data.settings.easyBonus * interval * ease) / 100;
        // fuzz
        if (interval >= 8) {
            let fuzz = [-0.05 * interval, 0, 0.05 * interval];
            interval += fuzz[Math.floor(Math.random() * fuzz.length)];
        }
        interval = Math.round(interval);
        let due = window.moment(Date.now() + interval * 24 * 3600 * 1000);
        let dueString = due.format("DD-MM-YYYY");
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
        this.statusBar.setText(`Review: ${this.dueNotesCount} notes, ${this.dueFlashcards.length} cards due`);
    }
    async findFlashcards(note) {
        let fileText = await this.app.vault.read(note);
        let fileCachedData = this.app.metadataCache.getFileCache(note) || {};
        let headings = fileCachedData.headings || [];
        let fileChanged = false;
        let now = Date.now();
        // basic cards
        for (let regex of [SINGLELINE_CARD_REGEX, MULTILINE_CARD_REGEX]) {
            let isSingleLine = regex == SINGLELINE_CARD_REGEX;
            for (let match of fileText.matchAll(regex)) {
                match[0] = match[0].trim();
                match[1] = match[1].trim();
                match[2] = match[2].trim();
                let cardObj;
                // flashcard already scheduled
                if (match[3]) {
                    let dueUnix = window
                        .moment(match[3], ["DD-MM-YYYY", "ddd MMM DD YYYY"])
                        .valueOf();
                    if (dueUnix <= now) {
                        cardObj = {
                            front: match[1],
                            back: match[2],
                            note,
                            isDue: true,
                            interval: parseInt(match[4]),
                            ease: parseInt(match[5]),
                            match,
                            isSingleLine,
                            isCloze: false,
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
                        isDue: false,
                        isCloze: false,
                    };
                    this.newFlashcards.push(cardObj);
                }
                addContextToCard(cardObj, match, headings);
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
                        .moment(scheduling[i][1], "DD-MM-YYYY")
                        .valueOf();
                    if (dueUnix <= now) {
                        this.dueFlashcards.push(cardObj);
                        cardObj = {
                            front,
                            back,
                            note,
                            isDue: true,
                            interval: parseInt(scheduling[i][2]),
                            ease: parseInt(scheduling[i][3]),
                            match,
                            isSingleLine: false,
                            isCloze: true,
                            clozeDeletionIdx: i,
                            relatedCards,
                        };
                    }
                    else
                        continue;
                }
                else {
                    // new card
                    cardObj = {
                        front,
                        back,
                        note,
                        match,
                        isSingleLine: false,
                        isDue: false,
                        isCloze: true,
                        clozeDeletionIdx: i,
                        relatedCards,
                    };
                    this.newFlashcards.push(cardObj);
                }
                relatedCards.push(cardObj);
                addContextToCard(cardObj, match, headings);
            }
        }
        if (fileChanged)
            await this.app.vault.modify(note, fileText);
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
function addContextToCard(cardObj, match, headings) {
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

module.exports = SRPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3BhZ2VyYW5rLmpzL2xpYi9pbmRleC5qcyIsInNyYy9zZXR0aW5ncy50cyIsInNyYy9jb25zdGFudHMudHMiLCJzcmMvZmxhc2hjYXJkLW1vZGFsLnRzIiwic3JjL3NpZGViYXIudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZvck93bihvYmplY3QsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCh0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JykgJiYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKG9iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKGtleSwgb2JqZWN0W2tleV0pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHtcbiAgICAgICAgY291bnQ6IDAsXG4gICAgICAgIGVkZ2VzOiB7fSxcbiAgICAgICAgbm9kZXM6IHt9XG4gICAgfTtcblxuICAgIHNlbGYubGluayA9IGZ1bmN0aW9uIChzb3VyY2UsIHRhcmdldCwgd2VpZ2h0KSB7XG4gICAgICAgIGlmICgoaXNGaW5pdGUod2VpZ2h0KSAhPT0gdHJ1ZSkgfHwgKHdlaWdodCA9PT0gbnVsbCkpIHtcbiAgICAgICAgICAgIHdlaWdodCA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHdlaWdodCA9IHBhcnNlRmxvYXQod2VpZ2h0KTtcblxuICAgICAgICBpZiAoc2VsZi5ub2Rlcy5oYXNPd25Qcm9wZXJ0eShzb3VyY2UpICE9PSB0cnVlKSB7XG4gICAgICAgICAgICBzZWxmLmNvdW50Kys7XG4gICAgICAgICAgICBzZWxmLm5vZGVzW3NvdXJjZV0gPSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0OiAwLFxuICAgICAgICAgICAgICAgIG91dGJvdW5kOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kICs9IHdlaWdodDtcblxuICAgICAgICBpZiAoc2VsZi5ub2Rlcy5oYXNPd25Qcm9wZXJ0eSh0YXJnZXQpICE9PSB0cnVlKSB7XG4gICAgICAgICAgICBzZWxmLmNvdW50Kys7XG4gICAgICAgICAgICBzZWxmLm5vZGVzW3RhcmdldF0gPSB7XG4gICAgICAgICAgICAgICAgd2VpZ2h0OiAwLFxuICAgICAgICAgICAgICAgIG91dGJvdW5kOiAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNlbGYuZWRnZXMuaGFzT3duUHJvcGVydHkoc291cmNlKSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgc2VsZi5lZGdlc1tzb3VyY2VdID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsZi5lZGdlc1tzb3VyY2VdLmhhc093blByb3BlcnR5KHRhcmdldCkgIT09IHRydWUpIHtcbiAgICAgICAgICAgIHNlbGYuZWRnZXNbc291cmNlXVt0YXJnZXRdID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuZWRnZXNbc291cmNlXVt0YXJnZXRdICs9IHdlaWdodDtcbiAgICB9O1xuXG4gICAgc2VsZi5yYW5rID0gZnVuY3Rpb24gKGFscGhhLCBlcHNpbG9uLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgZGVsdGEgPSAxLFxuICAgICAgICAgICAgaW52ZXJzZSA9IDEgLyBzZWxmLmNvdW50O1xuXG4gICAgICAgIGZvck93bihzZWxmLmVkZ2VzLCBmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kID4gMCkge1xuICAgICAgICAgICAgICAgIGZvck93bihzZWxmLmVkZ2VzW3NvdXJjZV0sIGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5lZGdlc1tzb3VyY2VdW3RhcmdldF0gLz0gc2VsZi5ub2Rlc1tzb3VyY2VdLm91dGJvdW5kO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgc2VsZi5ub2Rlc1trZXldLndlaWdodCA9IGludmVyc2U7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdoaWxlIChkZWx0YSA+IGVwc2lsb24pIHtcbiAgICAgICAgICAgIHZhciBsZWFrID0gMCxcbiAgICAgICAgICAgICAgICBub2RlcyA9IHt9O1xuXG4gICAgICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBub2Rlc1trZXldID0gdmFsdWUud2VpZ2h0O1xuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlLm91dGJvdW5kID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGxlYWsgKz0gdmFsdWUud2VpZ2h0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNlbGYubm9kZXNba2V5XS53ZWlnaHQgPSAwO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxlYWsgKj0gYWxwaGE7XG5cbiAgICAgICAgICAgIGZvck93bihzZWxmLm5vZGVzLCBmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgICAgICAgICAgICAgZm9yT3duKHNlbGYuZWRnZXNbc291cmNlXSwgZnVuY3Rpb24gKHRhcmdldCwgd2VpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYubm9kZXNbdGFyZ2V0XS53ZWlnaHQgKz0gYWxwaGEgKiBub2Rlc1tzb3VyY2VdICogd2VpZ2h0O1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5ub2Rlc1tzb3VyY2VdLndlaWdodCArPSAoMSAtIGFscGhhKSAqIGludmVyc2UgKyBsZWFrICogaW52ZXJzZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkZWx0YSA9IDA7XG5cbiAgICAgICAgICAgIGZvck93bihzZWxmLm5vZGVzLCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGRlbHRhICs9IE1hdGguYWJzKHZhbHVlLndlaWdodCAtIG5vZGVzW2tleV0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3JPd24oc2VsZi5ub2RlcywgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGtleSwgc2VsZi5ub2Rlc1trZXldLndlaWdodCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBzZWxmLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmNvdW50ID0gMDtcbiAgICAgICAgc2VsZi5lZGdlcyA9IHt9O1xuICAgICAgICBzZWxmLm5vZGVzID0ge307XG4gICAgfTtcblxuICAgIHJldHVybiBzZWxmO1xufSkoKTtcbiIsImltcG9ydCB7IE5vdGljZSwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBTUlBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU1JTZXR0aW5ncyB7XG4gICAgLy8gZmxhc2hjYXJkc1xuICAgIGZsYXNoY2FyZHNUYWc6IHN0cmluZztcbiAgICBzaW5nbGVMaW5lQ29tbWVudE9uU2FtZUxpbmU6IGJvb2xlYW47XG4gICAgYnVyeVJlbGF0ZWRDYXJkczogYm9vbGVhbjtcbiAgICAvLyBub3Rlc1xuICAgIHRhZ3NUb1Jldmlldzogc3RyaW5nW107XG4gICAgb3BlblJhbmRvbU5vdGU6IGJvb2xlYW47XG4gICAgYXV0b05leHROb3RlOiBib29sZWFuO1xuICAgIGRpc2FibGVGaWxlTWVudVJldmlld09wdGlvbnM6IGJvb2xlYW47XG4gICAgLy8gYWxnb3JpdGhtXG4gICAgYmFzZUVhc2U6IG51bWJlcjtcbiAgICBtYXhMaW5rRmFjdG9yOiBudW1iZXI7XG4gICAgbGFwc2VzSW50ZXJ2YWxDaGFuZ2U6IG51bWJlcjtcbiAgICBlYXN5Qm9udXM6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFNSU2V0dGluZ3MgPSB7XG4gICAgLy8gZmxhc2hjYXJkc1xuICAgIGZsYXNoY2FyZHNUYWc6IFwiI2ZsYXNoY2FyZHNcIixcbiAgICBzaW5nbGVMaW5lQ29tbWVudE9uU2FtZUxpbmU6IGZhbHNlLFxuICAgIGJ1cnlSZWxhdGVkQ2FyZHM6IGZhbHNlLFxuICAgIC8vIG5vdGVzXG4gICAgdGFnc1RvUmV2aWV3OiBbXCIjcmV2aWV3XCJdLFxuICAgIG9wZW5SYW5kb21Ob3RlOiBmYWxzZSxcbiAgICBhdXRvTmV4dE5vdGU6IGZhbHNlLFxuICAgIGRpc2FibGVGaWxlTWVudVJldmlld09wdGlvbnM6IGZhbHNlLFxuICAgIC8vIGFsZ29yaXRobVxuICAgIGJhc2VFYXNlOiAyNTAsXG4gICAgbWF4TGlua0ZhY3RvcjogMS4wLFxuICAgIGxhcHNlc0ludGVydmFsQ2hhbmdlOiAwLjUsXG4gICAgZWFzeUJvbnVzOiAxLjMsXG59O1xuXG5leHBvcnQgY2xhc3MgU1JTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gICAgcHJpdmF0ZSBwbHVnaW46IFNSUGx1Z2luO1xuXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogU1JQbHVnaW4pIHtcbiAgICAgICAgc3VwZXIoYXBwLCBwbHVnaW4pO1xuICAgICAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB9XG5cbiAgICBkaXNwbGF5KCkge1xuICAgICAgICBsZXQgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblxuICAgICAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZURpdigpLmlubmVySFRNTCA9XG4gICAgICAgICAgICBcIjxoMj5TcGFjZWQgUmVwZXRpdGlvbiBQbHVnaW4gLSBTZXR0aW5nczwvaDI+XCI7XG5cbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KCkuaW5uZXJIVE1MID1cbiAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgY2hlY2sgdGhlIDxhIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vc3QzdjNubXcvb2JzaWRpYW4tc3BhY2VkLXJlcGV0aXRpb24vd2lraVwiPndpa2k8L2E+Lic7XG5cbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KCkuaW5uZXJIVE1MID0gXCI8aDM+Rmxhc2hjYXJkczwvaDM+XCI7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkZsYXNoY2FyZHMgdGFnXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIkVudGVyIG9uZSB0YWcgaS5lLiAjZmxhc2hjYXJkcy5cIilcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKGAke3RoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkc1RhZ31gKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmZsYXNoY2FyZHNUYWcgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXG4gICAgICAgICAgICAgICAgXCJTYXZlIHNjaGVkdWxpbmcgY29tbWVudCBmb3Igc2luZ2xlLWxpbmUgZmxhc2hjYXJkcyBvbiB0aGUgc2FtZSBsaW5lP1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIlR1cm5pbmcgdGhpcyBvbiB3aWxsIG1ha2UgdGhlIEhUTUwgY29tbWVudHMgbm90IGJyZWFrIGxpc3QgZm9ybWF0dGluZ1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgICAgIC5zZXRWYWx1ZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3Muc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5zaW5nbGVMaW5lQ29tbWVudE9uU2FtZUxpbmUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJCdXJ5IHJlbGF0ZWQgY2FyZHMgdW50aWwgdGhlIG5leHQgcmV2aWV3IHNlc3Npb24/XCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIlRoaXMgYXBwbGllcyB0byBvdGhlciBjbG96ZSBkZWxldGlvbnMgaW4gY2xvemUgY2FyZHNcIilcbiAgICAgICAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgICAgICAgICB0b2dnbGVcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYnVyeVJlbGF0ZWRDYXJkcylcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5idXJ5UmVsYXRlZENhcmRzID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBjb250YWluZXJFbC5jcmVhdGVEaXYoKS5pbm5lckhUTUwgPSBcIjxoMz5Ob3RlczwvaDM+XCI7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIlRhZ3MgdG8gcmV2aWV3XCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcIkVudGVyIHRhZ3Mgc2VwYXJhdGVkIGJ5IHNwYWNlcyBpLmUuICNyZXZpZXcgI3RhZzIgI3RhZzMuXCIpXG4gICAgICAgICAgICAuYWRkVGV4dEFyZWEoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5qb2luKFwiIFwiKX1gXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy50YWdzVG9SZXZpZXcgPSB2YWx1ZS5zcGxpdChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJPcGVuIGEgcmFuZG9tIG5vdGUgZm9yIHJldmlld1wiKVxuICAgICAgICAgICAgLnNldERlc2MoXG4gICAgICAgICAgICAgICAgXCJXaGVuIHlvdSB0dXJuIHRoaXMgb2ZmLCBub3RlcyBhcmUgb3JkZXJlZCBieSBpbXBvcnRhbmNlIChQYWdlUmFuaylcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5vcGVuUmFuZG9tTm90ZSlcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5vcGVuUmFuZG9tTm90ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpbkRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIk9wZW4gbmV4dCBub3RlIGF1dG9tYXRpY2FsbHkgYWZ0ZXIgYSByZXZpZXdcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFwiRm9yIGZhc3RlciByZXZpZXdzXCIpXG4gICAgICAgICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmF1dG9OZXh0Tm90ZSlcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5hdXRvTmV4dE5vdGUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXG4gICAgICAgICAgICAgICAgXCJEaXNhYmxlIHJldmlldyBvcHRpb25zIGluIHRoZSBmaWxlIG1lbnUgaS5lLiBSZXZpZXc6IEVhc3kgR29vZCBIYXJkXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIFwiQWZ0ZXIgZGlzYWJsaW5nLCB5b3UgY2FuIHJldmlldyB1c2luZyB0aGUgY29tbWFuZCBob3RrZXlzLiBSZWxvYWQgT2JzaWRpYW4gYWZ0ZXIgY2hhbmdpbmcgdGhpcy5cIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICAgICAgICAgIHRvZ2dsZVxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmRpc2FibGVGaWxlTWVudVJldmlld09wdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmRpc2FibGVGaWxlTWVudVJldmlld09wdGlvbnMgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZURpdigpLmlubmVySFRNTCA9IFwiPGgzPkFsZ29yaXRobTwvaDM+XCI7XG5cbiAgICAgICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KCkuaW5uZXJIVE1MID1cbiAgICAgICAgICAgICdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgY2hlY2sgdGhlIDxhIGhyZWY9XCJodHRwczovL2dpdGh1Yi5jb20vc3QzdjNubXcvb2JzaWRpYW4tc3BhY2VkLXJlcGV0aXRpb24vd2lraS9TcGFjZWQtUmVwZXRpdGlvbi1BbGdvcml0aG1cIj5hbGdvcml0aG0gaW1wbGVtZW50YXRpb248L2E+Lic7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkJhc2UgZWFzZVwiKVxuICAgICAgICAgICAgLnNldERlc2MoXCJtaW5pbXVtID0gMTMwLCBwcmVmZXJyYWJseSBhcHByb3hpbWF0ZWx5IDI1MFwiKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5iYXNlRWFzZX1gKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVmFsdWU6IG51bWJlciA9IE51bWJlci5wYXJzZUludCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChudW1WYWx1ZSA8IDEzMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJUaGUgYmFzZSBlYXNlIG11c3QgYmUgYXQgbGVhc3QgMTMwLlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHQuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJhc2VFYXNlfWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYmFzZUVhc2UgPSBudW1WYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlUGx1Z2luRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFwiUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBudW1iZXIuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgICAgIC5zZXROYW1lKFwiSW50ZXJ2YWwgY2hhbmdlIHdoZW4geW91IHJldmlldyBhIG5vdGUvY29uY2VwdCBhcyBoYXJkXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIm5ld0ludGVydmFsID0gb2xkSW50ZXJ2YWwgKiBpbnRlcnZhbENoYW5nZSAvIDEwMCwgMCUgPCBpbnRlcnZhbENoYW5nZSA8IDEwMCVcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlICogMTAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9YFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBudW1WYWx1ZTogbnVtYmVyID0gTnVtYmVyLnBhcnNlSW50KHZhbHVlKSAvIDEwMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNOYU4obnVtVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG51bVZhbHVlIDwgMC4wMSB8fCBudW1WYWx1ZSA+IDAuOTkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGxvYWQgYmFsYW5jaW5nIHRocmVzaG9sZCBtdXN0IGJlIGluIHRoZSByYW5nZSAwJSA8IGludGVydmFsQ2hhbmdlIDwgMTAwJS5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubGFwc2VzSW50ZXJ2YWxDaGFuZ2UgKiAxMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlID0gbnVtVmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVBsdWdpbkRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcIlBsZWFzZSBwcm92aWRlIGEgdmFsaWQgbnVtYmVyLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgICAuc2V0TmFtZShcIkVhc3kgYm9udXNcIilcbiAgICAgICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgICAgICAgIFwiVGhlIGVhc3kgYm9udXMgYWxsb3dzIHlvdSB0byBzZXQgdGhlIGRpZmZlcmVuY2UgaW4gaW50ZXJ2YWxzIGJldHdlZW4gYW5zd2VyaW5nIEdvb2QgYW5kIEVhc3kgb24gYSBjYXJkIChtaW5pbXVtID0gMTAwJSlcIlxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgICAgICAgICAgdGV4dFxuICAgICAgICAgICAgICAgICAgICAuc2V0VmFsdWUoYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5lYXN5Qm9udXMgKiAxMDB9YClcbiAgICAgICAgICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG51bVZhbHVlOiBudW1iZXIgPSBOdW1iZXIucGFyc2VJbnQodmFsdWUpIC8gMTAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc05hTihudW1WYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobnVtVmFsdWUgPCAxLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGVhc3kgYm9udXMgbXVzdCBiZSBhdCBsZWFzdCAxMDAuXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dC5zZXRWYWx1ZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGAke1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuZWFzeUJvbnVzICpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmVhc3lCb251cyA9IG51bVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIG51bWJlci5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgICAgLnNldE5hbWUoXCJNYXhpbXVtIGxpbmsgY29udHJpYnV0aW9uXCIpXG4gICAgICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICAgICAgICBcIk1heC4gY29udHJpYnV0aW9uIG9mIHRoZSB3ZWlnaHRlZCBlYXNlIG9mIGxpbmtlZCBub3RlcyB0byB0aGUgaW5pdGlhbCBlYXNlICgwJSA8PSBtYXhMaW5rRmFjdG9yIDw9IDEwMCUpXCJcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICAgICAgICAgIHRleHRcbiAgICAgICAgICAgICAgICAgICAgLnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgYCR7dGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5tYXhMaW5rRmFjdG9yICogMTAwfWBcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbnVtVmFsdWU6IG51bWJlciA9IE51bWJlci5wYXJzZUludCh2YWx1ZSkgLyAxMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKG51bVZhbHVlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChudW1WYWx1ZSA8IDAgfHwgbnVtVmFsdWUgPiAxLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVGhlIGxpbmsgZmFjdG9yIG11c3QgYmUgaW4gdGhlIHJhbmdlIDAlIDw9IG1heExpbmtGYWN0b3IgPD0gMTAwJS5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0LnNldFZhbHVlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYCR7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5nc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWF4TGlua0ZhY3RvciAqIDEwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MubWF4TGlua0ZhY3RvciA9IG51bVZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVQbHVnaW5EYXRhKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIG51bWJlci5cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgIH1cbn1cbiIsImV4cG9ydCBjb25zdCBTQ0hFRFVMSU5HX0lORk9fUkVHRVggPSAvXi0tLVxcbigoPzouKlxcbikqKXNyLWR1ZTogKC4rKVxcbnNyLWludGVydmFsOiAoXFxkKylcXG5zci1lYXNlOiAoXFxkKylcXG4oKD86LipcXG4pKiktLS0vO1xuZXhwb3J0IGNvbnN0IFlBTUxfRlJPTlRfTUFUVEVSX1JFR0VYID0gL14tLS1cXG4oKD86LipcXG4pKiktLS0vO1xuZXhwb3J0IGNvbnN0IFNJTkdMRUxJTkVfQ0FSRF9SRUdFWCA9IC9eKC4rKTo6KC4rPylcXG4/KD86PCEtLVNSOiguKyksKFxcZCspLChcXGQrKS0tPnwkKS9nbTtcbmV4cG9ydCBjb25zdCBNVUxUSUxJTkVfQ0FSRF9SRUdFWCA9IC9eKCg/Oi4rXFxuKSspXFw/XFxuKCg/Oi4rXFxuKSs/KSg/OjwhLS1TUjooLispLChcXGQrKSwoXFxkKyktLT58JCkvZ207XG5leHBvcnQgY29uc3QgQ0xPWkVfQ0FSRF9ERVRFQ1RPUiA9IC8oPzouK1xcbikqXi4qPz09Lio/PT0uKlxcbig/Oi4rXFxuPykqL2dtOyAvLyBjYXJkIG11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgY2xvemVcbmV4cG9ydCBjb25zdCBDTE9aRV9ERUxFVElPTlNfRVhUUkFDVE9SID0gLz09KC4qPyk9PS9nbTtcbmV4cG9ydCBjb25zdCBDTE9aRV9TQ0hFRFVMSU5HX0VYVFJBQ1RPUiA9IC8hKFtcXGQtXSspLChcXGQrKSwoXFxkKykvZ207XG5cbmV4cG9ydCBjb25zdCBDUk9TU19IQUlSU19JQ09OID0gYDxwYXRoIHN0eWxlPVwiIHN0cm9rZTpub25lO2ZpbGwtcnVsZTpub256ZXJvO2ZpbGw6Y3VycmVudENvbG9yO2ZpbGwtb3BhY2l0eToxO1wiIGQ9XCJNIDk5LjkyMTg3NSA0Ny45NDE0MDYgTCA5My4wNzQyMTkgNDcuOTQxNDA2IEMgOTIuODQzNzUgNDIuMDMxMjUgOTEuMzkwNjI1IDM2LjIzODI4MSA4OC44MDA3ODEgMzAuOTIxODc1IEwgODUuMzY3MTg4IDMyLjU4MjAzMSBDIDg3LjY2Nzk2OSAzNy4zNTU0NjkgODguOTY0ODQ0IDQyLjU1MDc4MSA4OS4xODM1OTQgNDcuODQzNzUgTCA4Mi4yMzgyODEgNDcuODQzNzUgQyA4Mi4wOTc2NTYgNDQuNjE3MTg4IDgxLjU4OTg0NCA0MS40MTc5NjkgODAuNzM0Mzc1IDM4LjMwNDY4OCBMIDc3LjA1MDc4MSAzOS4zMzU5MzggQyA3Ny44MDg1OTQgNDIuMDg5ODQ0IDc4LjI2MTcxOSA0NC45MTc5NjkgNzguNDA2MjUgNDcuNzY5NTMxIEwgNjUuODcxMDk0IDQ3Ljc2OTUzMSBDIDY0LjkxNDA2MiA0MC41MDc4MTIgNTkuMTQ0NTMxIDM0LjgzMjAzMSA1MS44NzEwOTQgMzMuOTk2MDk0IEwgNTEuODcxMDk0IDIxLjM4NjcxOSBDIDU0LjgxNjQwNiAyMS41MDc4MTIgNTcuNzQyMTg4IDIxLjk2MDkzOCA2MC41ODU5MzggMjIuNzM4MjgxIEwgNjEuNjE3MTg4IDE5LjA1ODU5NCBDIDU4LjQzNzUgMTguMTkxNDA2IDU1LjE2NDA2MiAxNy42OTE0MDYgNTEuODcxMDk0IDE3LjU3MDMxMiBMIDUxLjg3MTA5NCAxMC41NTA3ODEgQyA1Ny4xNjQwNjIgMTAuNzY5NTMxIDYyLjM1NTQ2OSAxMi4wNjY0MDYgNjcuMTMyODEyIDE0LjM2MzI4MSBMIDY4Ljc4OTA2MiAxMC45Mjk2ODggQyA2My41IDguMzgyODEyIDU3LjczODI4MSA2Ljk1MzEyNSA1MS44NzEwOTQgNi43MzQzNzUgTCA1MS44NzEwOTQgMC4wMzkwNjI1IEwgNDguMDU0Njg4IDAuMDM5MDYyNSBMIDQ4LjA1NDY4OCA2LjczNDM3NSBDIDQyLjE3OTY4OCA2Ljk3NjU2MiAzNi40MTc5NjkgOC40MzM1OTQgMzEuMTMyODEyIDExLjAwNzgxMiBMIDMyLjc5Mjk2OSAxNC40NDE0MDYgQyAzNy41NjY0MDYgMTIuMTQwNjI1IDQyLjc2MTcxOSAxMC44NDM3NSA0OC4wNTQ2ODggMTAuNjI1IEwgNDguMDU0Njg4IDE3LjU3MDMxMiBDIDQ0LjgyODEyNSAxNy43MTQ4NDQgNDEuNjI4OTA2IDE4LjIxODc1IDM4LjUxNTYyNSAxOS4wNzgxMjUgTCAzOS41NDY4NzUgMjIuNzU3ODEyIEMgNDIuMzI0MjE5IDIxLjk4ODI4MSA0NS4xNzU3ODEgMjEuNTMxMjUgNDguMDU0Njg4IDIxLjM4NjcxOSBMIDQ4LjA1NDY4OCAzNC4wMzEyNSBDIDQwLjc5Njg3NSAzNC45NDkyMTkgMzUuMDg5ODQ0IDQwLjY3OTY4OCAzNC4yMDMxMjUgNDcuOTQxNDA2IEwgMjEuNSA0Ny45NDE0MDYgQyAyMS42MzI4MTIgNDUuMDQyOTY5IDIyLjA4OTg0NCA0Mi4xNzE4NzUgMjIuODU1NDY5IDM5LjM3NSBMIDE5LjE3MTg3NSAzOC4zNDM3NSBDIDE4LjMxMjUgNDEuNDU3MDMxIDE3LjgwODU5NCA0NC42NTYyNSAxNy42NjQwNjIgNDcuODgyODEyIEwgMTAuNjY0MDYyIDQ3Ljg4MjgxMiBDIDEwLjg4MjgxMiA0Mi41ODk4NDQgMTIuMTc5Njg4IDM3LjM5NDUzMSAxNC40ODA0NjkgMzIuNjIxMDk0IEwgMTEuMTIxMDk0IDMwLjkyMTg3NSBDIDguNTM1MTU2IDM2LjIzODI4MSA3LjA3ODEyNSA0Mi4wMzEyNSA2Ljg0NzY1NiA0Ny45NDE0MDYgTCAwIDQ3Ljk0MTQwNiBMIDAgNTEuNzUzOTA2IEwgNi44NDc2NTYgNTEuNzUzOTA2IEMgNy4wODk4NDQgNTcuNjM2NzE5IDguNTQyOTY5IDYzLjQwMjM0NCAxMS4xMjEwOTQgNjguNjk1MzEyIEwgMTQuNTU0Njg4IDY3LjAzNTE1NiBDIDEyLjI1NzgxMiA2Mi4yNjE3MTkgMTAuOTU3MDMxIDU3LjA2NjQwNiAxMC43MzgyODEgNTEuNzczNDM4IEwgMTcuNzQyMTg4IDUxLjc3MzQzOCBDIDE3Ljg1NTQ2OSA1NS4wNDI5NjkgMTguMzQzNzUgNTguMjg5MDYyIDE5LjE5MTQwNiA2MS40NDUzMTIgTCAyMi44NzEwOTQgNjAuNDE0MDYyIEMgMjIuMDg5ODQ0IDU3LjU2MjUgMjEuNjI4OTA2IDU0LjYzMjgxMiAyMS41IDUxLjY3OTY4OCBMIDM0LjIwMzEyNSA1MS42Nzk2ODggQyAzNS4wNTg1OTQgNTguOTY4NzUgNDAuNzczNDM4IDY0LjczODI4MSA0OC4wNTQ2ODggNjUuNjYwMTU2IEwgNDguMDU0Njg4IDc4LjMwODU5NCBDIDQ1LjEwNTQ2OSA3OC4xODc1IDQyLjE4MzU5NCA3Ny43MzA0NjkgMzkuMzM1OTM4IDc2Ljk1NzAzMSBMIDM4LjMwNDY4OCA4MC42MzY3MTkgQyA0MS40ODgyODEgODEuNTExNzE5IDQ0Ljc1NzgxMiA4Mi4wMTU2MjUgNDguMDU0Njg4IDgyLjE0NDUzMSBMIDQ4LjA1NDY4OCA4OS4xNDQ1MzEgQyA0Mi43NjE3MTkgODguOTI1NzgxIDM3LjU2NjQwNiA4Ny42Mjg5MDYgMzIuNzkyOTY5IDg1LjMyODEyNSBMIDMxLjEzMjgxMiA4OC43NjU2MjUgQyAzNi40MjU3ODEgOTEuMzEyNSA0Mi4xODM1OTQgOTIuNzQyMTg4IDQ4LjA1NDY4OCA5Mi45NjA5MzggTCA0OC4wNTQ2ODggOTkuOTYwOTM4IEwgNTEuODcxMDk0IDk5Ljk2MDkzOCBMIDUxLjg3MTA5NCA5Mi45NjA5MzggQyA1Ny43NSA5Mi43MTg3NSA2My41MTk1MzEgOTEuMjY1NjI1IDY4LjgwODU5NCA4OC42ODc1IEwgNjcuMTMyODEyIDg1LjI1MzkwNiBDIDYyLjM1NTQ2OSA4Ny41NTA3ODEgNTcuMTY0MDYyIDg4Ljg1MTU2MiA1MS44NzEwOTQgODkuMDcwMzEyIEwgNTEuODcxMDk0IDgyLjEyNSBDIDU1LjA5Mzc1IDgxLjk4MDQ2OSA1OC4yOTI5NjkgODEuNDc2NTYyIDYxLjQwNjI1IDgwLjYxNzE4OCBMIDYwLjM3ODkwNiA3Ni45Mzc1IEMgNTcuNTc0MjE5IDc3LjcwMzEyNSA1NC42OTUzMTIgNzguMTU2MjUgNTEuNzkyOTY5IDc4LjI4OTA2MiBMIDUxLjc5Mjk2OSA2NS42Nzk2ODggQyA1OS4xMjEwOTQgNjQuODI4MTI1IDY0LjkxMDE1NiA1OS4wNjI1IDY1Ljc5Njg3NSA1MS43MzQzNzUgTCA3OC4zNjcxODggNTEuNzM0Mzc1IEMgNzguMjUgNTQuNzM0Mzc1IDc3Ljc4OTA2MiA1Ny43MTA5MzggNzYuOTkyMTg4IDYwLjYwNTQ2OSBMIDgwLjY3NTc4MSA2MS42MzY3MTkgQyA4MS41NTg1OTQgNTguNDA2MjUgODIuMDY2NDA2IDU1LjA4MjAzMSA4Mi4xODM1OTQgNTEuNzM0Mzc1IEwgODkuMjYxNzE5IDUxLjczNDM3NSBDIDg5LjA0Mjk2OSA1Ny4wMzEyNSA4Ny43NDIxODggNjIuMjIyNjU2IDg1LjQ0NTMxMiA2Ni45OTYwOTQgTCA4OC44Nzg5MDYgNjguNjU2MjUgQyA5MS40NTcwMzEgNjMuMzY3MTg4IDkyLjkxMDE1NiA1Ny41OTc2NTYgOTMuMTUyMzQ0IDUxLjcxODc1IEwgMTAwIDUxLjcxODc1IFogTSA2Mi4wMTk1MzEgNTEuNzM0Mzc1IEMgNjEuMTgzNTk0IDU2Ljk0NTMxMiA1Ny4wODU5MzggNjEuMDIzNDM4IDUxLjg3MTA5NCA2MS44MjgxMjUgTCA1MS44NzEwOTQgNTcuNTE1NjI1IEwgNDguMDU0Njg4IDU3LjUxNTYyNSBMIDQ4LjA1NDY4OCA2MS44MDg1OTQgQyA0Mi45MTAxNTYgNjAuOTQ5MjE5IDM4Ljg4NjcxOSA1Ni45MDIzNDQgMzguMDU4NTk0IDUxLjc1MzkwNiBMIDQyLjMzMjAzMSA1MS43NTM5MDYgTCA0Mi4zMzIwMzEgNDcuOTQxNDA2IEwgMzguMDU4NTk0IDQ3Ljk0MTQwNiBDIDM4Ljg4NjcxOSA0Mi43ODkwNjIgNDIuOTEwMTU2IDM4Ljc0NjA5NCA0OC4wNTQ2ODggMzcuODg2NzE5IEwgNDguMDU0Njg4IDQyLjE3OTY4OCBMIDUxLjg3MTA5NCA0Mi4xNzk2ODggTCA1MS44NzEwOTQgMzcuODQ3NjU2IEMgNTcuMDc4MTI1IDM4LjY0ODQzOCA2MS4xNzk2ODggNDIuNzE4NzUgNjIuMDE5NTMxIDQ3LjkyMTg3NSBMIDU3LjcwNzAzMSA0Ny45MjE4NzUgTCA1Ny43MDcwMzEgNTEuNzM0Mzc1IFogTSA2Mi4wMTk1MzEgNTEuNzM0Mzc1IFwiLz5gO1xuZXhwb3J0IGNvbnN0IENPTExBUFNFX0lDT04gPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiB3aWR0aD1cIjhcIiBoZWlnaHQ9XCI4XCIgY2xhc3M9XCJyaWdodC10cmlhbmdsZVwiPjxwYXRoIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBkPVwiTTk0LjksMjAuOGMtMS40LTIuNS00LjEtNC4xLTcuMS00LjFIMTIuMmMtMywwLTUuNywxLjYtNy4xLDQuMWMtMS4zLDIuNC0xLjIsNS4yLDAuMiw3LjZMNDMuMSw4OGMxLjUsMi4zLDQsMy43LDYuOSwzLjcgczUuNC0xLjQsNi45LTMuN2wzNy44LTU5LjZDOTYuMSwyNiw5Ni4yLDIzLjIsOTQuOSwyMC44TDk0LjksMjAuOHpcIj48L3BhdGg+PC9zdmc+YDtcbiIsImltcG9ydCB7IE1vZGFsLCBBcHAsIE1hcmtkb3duUmVuZGVyZXIsIE5vdGljZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgU1JQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgQ2FyZCB9IGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IENMT1pFX1NDSEVEVUxJTkdfRVhUUkFDVE9SIH0gZnJvbSBcIi4vY29uc3RhbnRzXCI7XG5cbmVudW0gVXNlclJlc3BvbnNlIHtcbiAgICBTaG93QW5zd2VyLFxuICAgIFJldmlld0hhcmQsXG4gICAgUmV2aWV3R29vZCxcbiAgICBSZXZpZXdFYXN5LFxuICAgIFJlc2V0Q2FyZFByb2dyZXNzLFxuICAgIFNraXAsXG59XG5cbmVudW0gTW9kZSB7XG4gICAgRnJvbnQsXG4gICAgQmFjayxcbiAgICBDbG9zZWQsXG59XG5cbmV4cG9ydCBjbGFzcyBGbGFzaGNhcmRNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgICBwcml2YXRlIHBsdWdpbjogU1JQbHVnaW47XG4gICAgcHJpdmF0ZSBhbnN3ZXJCdG46IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgZmxhc2hjYXJkVmlldzogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBoYXJkQnRuOiBIVE1MRWxlbWVudDtcbiAgICBwcml2YXRlIGdvb2RCdG46IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgZWFzeUJ0bjogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSByZXNwb25zZURpdjogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBmaWxlTGlua1ZpZXc6IEhUTUxFbGVtZW50O1xuICAgIHByaXZhdGUgcmVzZXRMaW5rVmlldzogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBjb250ZXh0VmlldzogSFRNTEVsZW1lbnQ7XG4gICAgcHJpdmF0ZSBjdXJyZW50Q2FyZDogQ2FyZDtcbiAgICBwcml2YXRlIG1vZGU6IE1vZGU7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBTUlBsdWdpbikge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXG4gICAgICAgIHRoaXMudGl0bGVFbC5zZXRUZXh0KFwiUXVldWVcIik7XG4gICAgICAgIHRoaXMubW9kYWxFbC5zdHlsZS5oZWlnaHQgPSBcIjgwJVwiO1xuICAgICAgICB0aGlzLm1vZGFsRWwuc3R5bGUud2lkdGggPSBcIjQwJVwiO1xuXG4gICAgICAgIHRoaXMuY29udGVudEVsLnN0eWxlLnBvc2l0aW9uID0gXCJyZWxhdGl2ZVwiO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5zdHlsZS5oZWlnaHQgPSBcIjkyJVwiO1xuXG4gICAgICAgIHRoaXMuZmlsZUxpbmtWaWV3ID0gY3JlYXRlRGl2KFwic3ItbGlua1wiKTtcbiAgICAgICAgdGhpcy5maWxlTGlua1ZpZXcuc2V0VGV4dChcIk9wZW4gZmlsZVwiKTtcbiAgICAgICAgdGhpcy5maWxlTGlua1ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5hcHAud29ya3NwYWNlLmFjdGl2ZUxlYWYub3BlbkZpbGUoXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5ub3RlXG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQodGhpcy5maWxlTGlua1ZpZXcpO1xuXG4gICAgICAgIHRoaXMucmVzZXRMaW5rVmlldyA9IGNyZWF0ZURpdihcInNyLWxpbmtcIik7XG4gICAgICAgIHRoaXMucmVzZXRMaW5rVmlldy5zZXRUZXh0KFwiUmVzZXQgY2FyZCdzIHByb2dyZXNzXCIpO1xuICAgICAgICB0aGlzLnJlc2V0TGlua1ZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXNwb25zZShVc2VyUmVzcG9uc2UuUmVzZXRDYXJkUHJvZ3Jlc3MpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXNldExpbmtWaWV3LnN0eWxlLmZsb2F0ID0gXCJyaWdodFwiO1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5hcHBlbmRDaGlsZCh0aGlzLnJlc2V0TGlua1ZpZXcpO1xuXG4gICAgICAgIHRoaXMuY29udGV4dFZpZXcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICB0aGlzLmNvbnRleHRWaWV3LnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItY29udGV4dFwiKTtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQodGhpcy5jb250ZXh0Vmlldyk7XG5cbiAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuYXBwZW5kQ2hpbGQodGhpcy5mbGFzaGNhcmRWaWV3KTtcblxuICAgICAgICB0aGlzLnJlc3BvbnNlRGl2ID0gY3JlYXRlRGl2KFwic3ItcmVzcG9uc2VcIik7XG5cbiAgICAgICAgdGhpcy5oYXJkQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKTtcbiAgICAgICAgdGhpcy5oYXJkQnRuLnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItaGFyZC1idG5cIik7XG4gICAgICAgIHRoaXMuaGFyZEJ0bi5zZXRUZXh0KFwiSGFyZFwiKTtcbiAgICAgICAgdGhpcy5oYXJkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoXykgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlJldmlld0hhcmQpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZXNwb25zZURpdi5hcHBlbmRDaGlsZCh0aGlzLmhhcmRCdG4pO1xuXG4gICAgICAgIHRoaXMuZ29vZEJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIik7XG4gICAgICAgIHRoaXMuZ29vZEJ0bi5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInNyLWdvb2QtYnRuXCIpO1xuICAgICAgICB0aGlzLmdvb2RCdG4uc2V0VGV4dChcIkdvb2RcIik7XG4gICAgICAgIHRoaXMuZ29vZEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKF8pID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc1Jlc3BvbnNlKFVzZXJSZXNwb25zZS5SZXZpZXdHb29kKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVzcG9uc2VEaXYuYXBwZW5kQ2hpbGQodGhpcy5nb29kQnRuKTtcblxuICAgICAgICB0aGlzLmVhc3lCdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpO1xuICAgICAgICB0aGlzLmVhc3lCdG4uc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJzci1lYXN5LWJ0blwiKTtcbiAgICAgICAgdGhpcy5lYXN5QnRuLnNldFRleHQoXCJFYXN5XCIpO1xuICAgICAgICB0aGlzLmVhc3lCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChfKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXNwb25zZShVc2VyUmVzcG9uc2UuUmV2aWV3RWFzeSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnJlc3BvbnNlRGl2LmFwcGVuZENoaWxkKHRoaXMuZWFzeUJ0bik7XG4gICAgICAgIHRoaXMucmVzcG9uc2VEaXYuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMucmVzcG9uc2VEaXYpO1xuXG4gICAgICAgIHRoaXMuYW5zd2VyQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgdGhpcy5hbnN3ZXJCdG4uc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJzci1zaG93LWFuc3dlclwiKTtcbiAgICAgICAgdGhpcy5hbnN3ZXJCdG4uc2V0VGV4dChcIlNob3cgQW5zd2VyXCIpO1xuICAgICAgICB0aGlzLmFuc3dlckJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKF8pID0+IHtcbiAgICAgICAgICAgIHRoaXMucHJvY2Vzc1Jlc3BvbnNlKFVzZXJSZXNwb25zZS5TaG93QW5zd2VyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmFwcGVuZENoaWxkKHRoaXMuYW5zd2VyQnRuKTtcblxuICAgICAgICBkb2N1bWVudC5ib2R5Lm9ua2V5cHJlc3MgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMubW9kZSAhPSBNb2RlLkNsb3NlZCAmJiBlLmNvZGUgPT0gXCJLZXlTXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXNwb25zZShVc2VyUmVzcG9uc2UuU2tpcCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgICAgIHRoaXMubW9kZSA9PSBNb2RlLkZyb250ICYmXG4gICAgICAgICAgICAgICAgKGUuY29kZSA9PSBcIlNwYWNlXCIgfHwgZS5jb2RlID09IFwiRW50ZXJcIilcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NSZXNwb25zZShVc2VyUmVzcG9uc2UuU2hvd0Fuc3dlcik7XG4gICAgICAgICAgICBlbHNlIGlmICh0aGlzLm1vZGUgPT0gTW9kZS5CYWNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGUuY29kZSA9PSBcIk51bXBhZDFcIiB8fCBlLmNvZGUgPT0gXCJEaWdpdDFcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlJldmlld0hhcmQpO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGUuY29kZSA9PSBcIk51bXBhZDJcIiB8fCBlLmNvZGUgPT0gXCJEaWdpdDJcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlJldmlld0dvb2QpO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGUuY29kZSA9PSBcIk51bXBhZDNcIiB8fCBlLmNvZGUgPT0gXCJEaWdpdDNcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlJldmlld0Vhc3kpO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGUuY29kZSA9PSBcIk51bXBhZDBcIiB8fCBlLmNvZGUgPT0gXCJEaWdpdDBcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzUmVzcG9uc2UoVXNlclJlc3BvbnNlLlJlc2V0Q2FyZFByb2dyZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBvbk9wZW4oKSB7XG4gICAgICAgIHRoaXMubmV4dENhcmQoKTtcbiAgICB9XG5cbiAgICBvbkNsb3NlKCkge1xuICAgICAgICB0aGlzLm1vZGUgPSBNb2RlLkNsb3NlZDtcbiAgICB9XG5cbiAgICBuZXh0Q2FyZCgpIHtcbiAgICAgICAgdGhpcy5yZXNwb25zZURpdi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIHRoaXMucmVzZXRMaW5rVmlldy5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgIGxldCBjb3VudCA9XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5uZXdGbGFzaGNhcmRzLmxlbmd0aCArIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMubGVuZ3RoO1xuICAgICAgICB0aGlzLnRpdGxlRWwuc2V0VGV4dChgUXVldWUgLSAke2NvdW50fWApO1xuXG4gICAgICAgIGlmIChjb3VudCA9PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmFuc3dlckJ0bi5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICB0aGlzLmZpbGVMaW5rVmlldy5pbm5lckhUTUwgPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy5yZXNldExpbmtWaWV3LmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHRWaWV3LmlubmVySFRNTCA9IFwiXCI7XG4gICAgICAgICAgICB0aGlzLmZsYXNoY2FyZFZpZXcuaW5uZXJIVE1MID1cbiAgICAgICAgICAgICAgICBcIjxoMyBzdHlsZT0ndGV4dC1hbGlnbjogY2VudGVyOyBtYXJnaW4tdG9wOiA0NSU7Jz5Zb3UncmUgZG9uZSBmb3IgdGhlIGRheSA6RC48L2gzPlwiO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hbnN3ZXJCdG4uc3R5bGUuZGlzcGxheSA9IFwiaW5pdGlhbFwiO1xuICAgICAgICB0aGlzLmZsYXNoY2FyZFZpZXcuaW5uZXJIVE1MID0gXCJcIjtcbiAgICAgICAgdGhpcy5tb2RlID0gTW9kZS5Gcm9udDtcblxuICAgICAgICBpZiAodGhpcy5wbHVnaW4uZHVlRmxhc2hjYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkID0gdGhpcy5wbHVnaW4uZHVlRmxhc2hjYXJkc1swXTtcbiAgICAgICAgICAgIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5mcm9udCxcbiAgICAgICAgICAgICAgICB0aGlzLmZsYXNoY2FyZFZpZXcsXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5ub3RlLnBhdGgsXG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW5cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGxldCBoYXJkSW50ZXJ2YWwgPSB0aGlzLm5leHRTdGF0ZShcbiAgICAgICAgICAgICAgICBVc2VyUmVzcG9uc2UuUmV2aWV3SGFyZCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmludGVydmFsLFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuZWFzZVxuICAgICAgICAgICAgKS5pbnRlcnZhbDtcbiAgICAgICAgICAgIGxldCBnb29kSW50ZXJ2YWwgPSB0aGlzLm5leHRTdGF0ZShcbiAgICAgICAgICAgICAgICBVc2VyUmVzcG9uc2UuUmV2aWV3R29vZCxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmludGVydmFsLFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuZWFzZVxuICAgICAgICAgICAgKS5pbnRlcnZhbDtcbiAgICAgICAgICAgIGxldCBlYXN5SW50ZXJ2YWwgPSB0aGlzLm5leHRTdGF0ZShcbiAgICAgICAgICAgICAgICBVc2VyUmVzcG9uc2UuUmV2aWV3RWFzeSxcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmludGVydmFsLFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuZWFzZVxuICAgICAgICAgICAgKS5pbnRlcnZhbDtcblxuICAgICAgICAgICAgdGhpcy5oYXJkQnRuLnNldFRleHQoYEhhcmQgLSAke2hhcmRJbnRlcnZhbH0gZGF5KHMpYCk7XG4gICAgICAgICAgICB0aGlzLmdvb2RCdG4uc2V0VGV4dChgR29vZCAtICR7Z29vZEludGVydmFsfSBkYXkocylgKTtcbiAgICAgICAgICAgIHRoaXMuZWFzeUJ0bi5zZXRUZXh0KGBFYXN5IC0gJHtlYXN5SW50ZXJ2YWx9IGRheShzKWApO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGx1Z2luLm5ld0ZsYXNoY2FyZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZCA9IHRoaXMucGx1Z2luLm5ld0ZsYXNoY2FyZHNbMF07XG4gICAgICAgICAgICBNYXJrZG93blJlbmRlcmVyLnJlbmRlck1hcmtkb3duKFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuZnJvbnQsXG4gICAgICAgICAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQubm90ZS5wYXRoLFxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5oYXJkQnRuLnNldFRleHQoXCJIYXJkIC0gMS4wIGRheShzKVwiKTtcbiAgICAgICAgICAgIHRoaXMuZ29vZEJ0bi5zZXRUZXh0KFwiR29vZCAtIDIuNSBkYXkocylcIik7XG4gICAgICAgICAgICB0aGlzLmVhc3lCdG4uc2V0VGV4dChcIkVhc3kgLSAzLjUgZGF5KHMpXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb250ZXh0Vmlldy5zZXRUZXh0KHRoaXMuY3VycmVudENhcmQuY29udGV4dCk7XG4gICAgfVxuXG4gICAgYXN5bmMgcHJvY2Vzc1Jlc3BvbnNlKHJlc3BvbnNlOiBVc2VyUmVzcG9uc2UpIHtcbiAgICAgICAgaWYgKHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5TaG93QW5zd2VyKSB7XG4gICAgICAgICAgICB0aGlzLm1vZGUgPSBNb2RlLkJhY2s7XG5cbiAgICAgICAgICAgIHRoaXMuYW5zd2VyQnRuLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIjtcbiAgICAgICAgICAgIHRoaXMucmVzcG9uc2VEaXYuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5pc0R1ZSlcbiAgICAgICAgICAgICAgICB0aGlzLnJlc2V0TGlua1ZpZXcuc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lLWJsb2NrXCI7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q2FyZC5pc0Nsb3plKSB7XG4gICAgICAgICAgICAgICAgbGV0IGhyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImhyXCIpO1xuICAgICAgICAgICAgICAgIGhyLnNldEF0dHJpYnV0ZShcImlkXCIsIFwic3ItaHItY2FyZC1kaXZpZGVcIik7XG4gICAgICAgICAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LmFwcGVuZENoaWxkKGhyKTtcbiAgICAgICAgICAgIH0gZWxzZSB0aGlzLmZsYXNoY2FyZFZpZXcuaW5uZXJIVE1MID0gXCJcIjtcblxuICAgICAgICAgICAgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmJhY2ssXG4gICAgICAgICAgICAgICAgdGhpcy5mbGFzaGNhcmRWaWV3LFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQubm90ZS5wYXRoLFxuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgcmVzcG9uc2UgPT0gVXNlclJlc3BvbnNlLlJldmlld0hhcmQgfHxcbiAgICAgICAgICAgIHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5SZXZpZXdHb29kIHx8XG4gICAgICAgICAgICByZXNwb25zZSA9PSBVc2VyUmVzcG9uc2UuUmV2aWV3RWFzeSB8fFxuICAgICAgICAgICAgcmVzcG9uc2UgPT0gVXNlclJlc3BvbnNlLlJlc2V0Q2FyZFByb2dyZXNzXG4gICAgICAgICkge1xuICAgICAgICAgICAgbGV0IGludGVydmFsT3V0ZXIsIGVhc2VPdXRlciwgZHVlO1xuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UgIT0gVXNlclJlc3BvbnNlLlJlc2V0Q2FyZFByb2dyZXNzKSB7XG4gICAgICAgICAgICAgICAgLy8gc2NoZWR1bGVkIGNhcmRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5pc0R1ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzLnNwbGljZSgwLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHsgaW50ZXJ2YWwsIGVhc2UgfSA9IHRoaXMubmV4dFN0YXRlKFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDYXJkLmludGVydmFsLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q2FyZC5lYXNlXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIC8vIGRvbid0IGxvb2sgdG9vIGNsb3NlbHkgbG9sXG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsT3V0ZXIgPSBpbnRlcnZhbDtcbiAgICAgICAgICAgICAgICAgICAgZWFzZU91dGVyID0gZWFzZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsZXQgeyBpbnRlcnZhbCwgZWFzZSB9ID0gdGhpcy5uZXh0U3RhdGUoXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJhc2VFYXNlXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLm5ld0ZsYXNoY2FyZHMuc3BsaWNlKDAsIDEpO1xuICAgICAgICAgICAgICAgICAgICAvLyBkb24ndCBsb29rIHRvbyBjbG9zZWx5IGxvbFxuICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbE91dGVyID0gaW50ZXJ2YWw7XG4gICAgICAgICAgICAgICAgICAgIGVhc2VPdXRlciA9IGVhc2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZnV6elxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbE91dGVyID49IDgpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGZ1enogPSBbLTAuMDUgKiBpbnRlcnZhbE91dGVyLCAwLCAwLjA1ICogaW50ZXJ2YWxPdXRlcl07XG4gICAgICAgICAgICAgICAgICAgIGludGVydmFsT3V0ZXIgKz1cbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1enpbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZnV6ei5sZW5ndGgpXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaW50ZXJ2YWxPdXRlciA9IE1hdGgucm91bmQoaW50ZXJ2YWxPdXRlcik7XG4gICAgICAgICAgICAgICAgZHVlID0gd2luZG93Lm1vbWVudChcbiAgICAgICAgICAgICAgICAgICAgRGF0ZS5ub3coKSArIGludGVydmFsT3V0ZXIgKiAyNCAqIDM2MDAgKiAxMDAwXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW50ZXJ2YWxPdXRlciA9IDEuMDtcbiAgICAgICAgICAgICAgICBlYXNlT3V0ZXIgPSB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzLmJhc2VFYXNlO1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMuc3BsaWNlKDAsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMucHVzaCh0aGlzLmN1cnJlbnRDYXJkKTtcbiAgICAgICAgICAgICAgICBkdWUgPSB3aW5kb3cubW9tZW50KERhdGUubm93KCkpO1xuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJDYXJkJ3MgcHJvZ3Jlc3MgaGFzIGJlZW4gcmVzZXRcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBkdWVTdHJpbmcgPSBkdWUuZm9ybWF0KFwiREQtTU0tWVlZWVwiKTtcblxuICAgICAgICAgICAgbGV0IGZpbGVUZXh0ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZCh0aGlzLmN1cnJlbnRDYXJkLm5vdGUpO1xuICAgICAgICAgICAgbGV0IHJlcGxhY2VtZW50UmVnZXggPSBuZXcgUmVnRXhwKFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQubWF0Y2hbMF0ucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLFxuICAgICAgICAgICAgICAgICAgICBcIlxcXFwkJlwiXG4gICAgICAgICAgICAgICAgKSwgLy8gZXNjYXBlIHN0cmluZ1xuICAgICAgICAgICAgICAgIFwiZ21cIlxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQuaXNDbG96ZSkge1xuICAgICAgICAgICAgICAgIGxldCBjYXJkVGV4dCA9IHRoaXMuY3VycmVudENhcmQubWF0Y2hbMF07XG5cbiAgICAgICAgICAgICAgICBsZXQgc2NoZWRJZHggPSBjYXJkVGV4dC5sYXN0SW5kZXhPZihcIjwhLS1TUjpcIik7XG4gICAgICAgICAgICAgICAgaWYgKHNjaGVkSWR4ID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IHRpbWUgYWRkaW5nIHNjaGVkdWxpbmcgaW5mb3JtYXRpb24gdG8gZmxhc2hjYXJkXG4gICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0ID0gYCR7Y2FyZFRleHR9XFxuPCEtLVNSOiEke2R1ZVN0cmluZ30sJHtpbnRlcnZhbE91dGVyfSwke2Vhc2VPdXRlcn0tLT5gO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzY2hlZHVsaW5nID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uY2FyZFRleHQubWF0Y2hBbGwoQ0xPWkVfU0NIRURVTElOR19FWFRSQUNUT1IpLFxuICAgICAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBkZWxldGlvblNjaGVkID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgXCIwXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdWVTdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtpbnRlcnZhbE91dGVyfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHtlYXNlT3V0ZXJ9YCxcbiAgICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQuaXNEdWUpXG4gICAgICAgICAgICAgICAgICAgICAgICBzY2hlZHVsaW5nW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENhcmQuY2xvemVEZWxldGlvbklkeFxuICAgICAgICAgICAgICAgICAgICAgICAgXSA9IGRlbGV0aW9uU2NoZWQ7XG4gICAgICAgICAgICAgICAgICAgIGVsc2Ugc2NoZWR1bGluZy5wdXNoKGRlbGV0aW9uU2NoZWQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0ID0gY2FyZFRleHQucmVwbGFjZSgvPCEtLVNSOi4rLS0+L2dtLCBcIlwiKTtcbiAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQgKz0gXCI8IS0tU1I6XCI7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NoZWR1bGluZy5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0ICs9IGAhJHtzY2hlZHVsaW5nW2ldWzFdfSwke3NjaGVkdWxpbmdbaV1bMl19LCR7c2NoZWR1bGluZ1tpXVszXX1gO1xuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dCArPSBcIi0tPlwiO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZpbGVUZXh0ID0gZmlsZVRleHQucmVwbGFjZShyZXBsYWNlbWVudFJlZ2V4LCBjYXJkVGV4dCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgcmVsYXRlZENhcmQgb2YgdGhpcy5jdXJyZW50Q2FyZC5yZWxhdGVkQ2FyZHMpXG4gICAgICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkLm1hdGNoWzBdID0gY2FyZFRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuYnVyeVJlbGF0ZWRDYXJkcylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5idXJ5UmVsYXRlZENhcmRzKHRoaXMuY3VycmVudENhcmQucmVsYXRlZENhcmRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQuaXNTaW5nbGVMaW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzZXAgPSB0aGlzLnBsdWdpbi5kYXRhLnNldHRpbmdzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2luZ2xlTGluZUNvbW1lbnRPblNhbWVMaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICA/IFwiIFwiXG4gICAgICAgICAgICAgICAgICAgICAgICA6IFwiXFxuXCI7XG5cbiAgICAgICAgICAgICAgICAgICAgZmlsZVRleHQgPSBmaWxlVGV4dC5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVwbGFjZW1lbnRSZWdleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGAke3RoaXMuY3VycmVudENhcmQuZnJvbnR9Ojoke3RoaXMuY3VycmVudENhcmQuYmFja30ke3NlcH08IS0tU1I6JHtkdWVTdHJpbmd9LCR7aW50ZXJ2YWxPdXRlcn0sJHtlYXNlT3V0ZXJ9LS0+YFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVUZXh0ID0gZmlsZVRleHQucmVwbGFjZShcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50UmVnZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBgJHt0aGlzLmN1cnJlbnRDYXJkLmZyb250fVxcbj9cXG4ke3RoaXMuY3VycmVudENhcmQuYmFja31cXG48IS0tU1I6JHtkdWVTdHJpbmd9LCR7aW50ZXJ2YWxPdXRlcn0sJHtlYXNlT3V0ZXJ9LS0+YFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KHRoaXMuY3VycmVudENhcmQubm90ZSwgZmlsZVRleHQpO1xuICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5Ta2lwKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q2FyZC5pc0R1ZSkgdGhpcy5wbHVnaW4uZHVlRmxhc2hjYXJkcy5zcGxpY2UoMCwgMSk7XG4gICAgICAgICAgICBlbHNlIHRoaXMucGx1Z2luLm5ld0ZsYXNoY2FyZHMuc3BsaWNlKDAsIDEpO1xuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENhcmQuaXNDbG96ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmJ1cnlSZWxhdGVkQ2FyZHModGhpcy5jdXJyZW50Q2FyZC5yZWxhdGVkQ2FyZHMpO1xuICAgICAgICAgICAgdGhpcy5uZXh0Q2FyZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbmV4dFN0YXRlKHJlc3BvbnNlOiBVc2VyUmVzcG9uc2UsIGludGVydmFsOiBudW1iZXIsIGVhc2U6IG51bWJlcikge1xuICAgICAgICBpZiAocmVzcG9uc2UgIT0gVXNlclJlc3BvbnNlLlJldmlld0dvb2QpIHtcbiAgICAgICAgICAgIGVhc2UgPVxuICAgICAgICAgICAgICAgIHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5SZXZpZXdFYXN5XG4gICAgICAgICAgICAgICAgICAgID8gZWFzZSArIDIwXG4gICAgICAgICAgICAgICAgICAgIDogTWF0aC5tYXgoMTMwLCBlYXNlIC0gMjApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3BvbnNlID09IFVzZXJSZXNwb25zZS5SZXZpZXdIYXJkKVxuICAgICAgICAgICAgaW50ZXJ2YWwgPSBNYXRoLm1heChcbiAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgIGludGVydmFsICogdGhpcy5wbHVnaW4uZGF0YS5zZXR0aW5ncy5sYXBzZXNJbnRlcnZhbENoYW5nZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgZWxzZSBpZiAocmVzcG9uc2UgPT0gVXNlclJlc3BvbnNlLlJldmlld0dvb2QpXG4gICAgICAgICAgICBpbnRlcnZhbCA9IChpbnRlcnZhbCAqIGVhc2UpIC8gMTAwO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBpbnRlcnZhbCA9XG4gICAgICAgICAgICAgICAgKHRoaXMucGx1Z2luLmRhdGEuc2V0dGluZ3MuZWFzeUJvbnVzICogaW50ZXJ2YWwgKiBlYXNlKSAvIDEwMDtcblxuICAgICAgICByZXR1cm4geyBlYXNlLCBpbnRlcnZhbDogTWF0aC5yb3VuZChpbnRlcnZhbCAqIDEwKSAvIDEwIH07XG4gICAgfVxuXG4gICAgYnVyeVJlbGF0ZWRDYXJkcyhhcnI6IENhcmRbXSkge1xuICAgICAgICBmb3IgKGxldCByZWxhdGVkQ2FyZCBvZiBhcnIpIHtcbiAgICAgICAgICAgIGxldCBkdWVJZHggPSB0aGlzLnBsdWdpbi5kdWVGbGFzaGNhcmRzLmluZGV4T2YocmVsYXRlZENhcmQpO1xuICAgICAgICAgICAgbGV0IG5ld0lkeCA9IHRoaXMucGx1Z2luLm5ld0ZsYXNoY2FyZHMuaW5kZXhPZihyZWxhdGVkQ2FyZCk7XG5cbiAgICAgICAgICAgIGlmIChkdWVJZHggIT0gLTEpIHRoaXMucGx1Z2luLmR1ZUZsYXNoY2FyZHMuc3BsaWNlKGR1ZUlkeCwgMSk7XG4gICAgICAgICAgICBlbHNlIGlmIChuZXdJZHggIT0gLTEpIHRoaXMucGx1Z2luLm5ld0ZsYXNoY2FyZHMuc3BsaWNlKG5ld0lkeCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBJdGVtVmlldywgV29ya3NwYWNlTGVhZiwgTWVudSwgVEZpbGUgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIFNSUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IENPTExBUFNFX0lDT04gfSBmcm9tIFwiLi9jb25zdGFudHNcIjtcblxuZXhwb3J0IGNvbnN0IFJFVklFV19RVUVVRV9WSUVXX1RZUEUgPSBcInJldmlldy1xdWV1ZS1saXN0LXZpZXdcIjtcblxuZXhwb3J0IGNsYXNzIFJldmlld1F1ZXVlTGlzdFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gICAgcHJpdmF0ZSBwbHVnaW46IFNSUGx1Z2luO1xuICAgIHByaXZhdGUgYWN0aXZlRm9sZGVyczogU2V0PHN0cmluZz47XG5cbiAgICBjb25zdHJ1Y3RvcihsZWFmOiBXb3Jrc3BhY2VMZWFmLCBwbHVnaW46IFNSUGx1Z2luKSB7XG4gICAgICAgIHN1cGVyKGxlYWYpO1xuXG4gICAgICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgICAgICB0aGlzLmFjdGl2ZUZvbGRlcnMgPSBuZXcgU2V0KFtcIlRvZGF5XCJdKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIChfOiBhbnkpID0+IHRoaXMucmVkcmF3KCkpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgICAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIChfOiBhbnkpID0+IHRoaXMucmVkcmF3KCkpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBSRVZJRVdfUVVFVUVfVklFV19UWVBFO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXREaXNwbGF5VGV4dCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gXCJOb3RlcyBSZXZpZXcgUXVldWVcIjtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0SWNvbigpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gXCJjcm9zc2hhaXJzXCI7XG4gICAgfVxuXG4gICAgcHVibGljIG9uSGVhZGVyTWVudShtZW51OiBNZW51KSB7XG4gICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgaXRlbS5zZXRUaXRsZShcIkNsb3NlXCIpXG4gICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc1wiKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLmRldGFjaExlYXZlc09mVHlwZShcbiAgICAgICAgICAgICAgICAgICAgICAgIFJFVklFV19RVUVVRV9WSUVXX1RZUEVcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIHJlZHJhdygpIHtcbiAgICAgICAgY29uc3Qgb3BlbkZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXG4gICAgICAgIGNvbnN0IHJvb3RFbCA9IGNyZWF0ZURpdihcIm5hdi1mb2xkZXIgbW9kLXJvb3RcIik7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuRWwgPSByb290RWwuY3JlYXRlRGl2KFwibmF2LWZvbGRlci1jaGlsZHJlblwiKTtcblxuICAgICAgICBpZiAodGhpcy5wbHVnaW4ubmV3Tm90ZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vdGVzRm9sZGVyRWwgPSB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZvbGRlcihcbiAgICAgICAgICAgICAgICBjaGlsZHJlbkVsLFxuICAgICAgICAgICAgICAgIFwiTmV3XCIsXG4gICAgICAgICAgICAgICAgIXRoaXMuYWN0aXZlRm9sZGVycy5oYXMoXCJOZXdcIilcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IG5ld0ZpbGUgb2YgdGhpcy5wbHVnaW4ubmV3Tm90ZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZpbGUoXG4gICAgICAgICAgICAgICAgICAgIG5ld05vdGVzRm9sZGVyRWwsXG4gICAgICAgICAgICAgICAgICAgIG5ld0ZpbGUsXG4gICAgICAgICAgICAgICAgICAgIG9wZW5GaWxlICYmIG5ld0ZpbGUucGF0aCA9PT0gb3BlbkZpbGUucGF0aCxcbiAgICAgICAgICAgICAgICAgICAgIXRoaXMuYWN0aXZlRm9sZGVycy5oYXMoXCJOZXdcIilcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMucGx1Z2luLnNjaGVkdWxlZE5vdGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBub3c6IG51bWJlciA9IERhdGUubm93KCk7XG4gICAgICAgICAgICBsZXQgY3VyclVuaXggPSAtMTtcbiAgICAgICAgICAgIGxldCBmb2xkZXJFbCwgZm9sZGVyVGl0bGU7XG5cbiAgICAgICAgICAgIGZvciAobGV0IHNOb3RlIG9mIHRoaXMucGx1Z2luLnNjaGVkdWxlZE5vdGVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNOb3RlLmR1ZVVuaXggIT0gY3VyclVuaXgpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG5EYXlzID0gTWF0aC5jZWlsKFxuICAgICAgICAgICAgICAgICAgICAgICAgKHNOb3RlLmR1ZVVuaXggLSBub3cpIC8gKDI0ICogMzYwMCAqIDEwMDApXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIGZvbGRlclRpdGxlID1cbiAgICAgICAgICAgICAgICAgICAgICAgIG5EYXlzID09IC0xXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIlllc3RlcmRheVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBuRGF5cyA9PSAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBcIlRvZGF5XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IG5EYXlzID09IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IFwiVG9tb3Jyb3dcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogbmV3IERhdGUoc05vdGUuZHVlVW5peCkudG9EYXRlU3RyaW5nKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9sZGVyRWwgPSB0aGlzLmNyZWF0ZVJpZ2h0UGFuZUZvbGRlcihcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuRWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb2xkZXJUaXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICF0aGlzLmFjdGl2ZUZvbGRlcnMuaGFzKGZvbGRlclRpdGxlKVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICBjdXJyVW5peCA9IHNOb3RlLmR1ZVVuaXg7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVSaWdodFBhbmVGaWxlKFxuICAgICAgICAgICAgICAgICAgICBmb2xkZXJFbCxcbiAgICAgICAgICAgICAgICAgICAgc05vdGUubm90ZSxcbiAgICAgICAgICAgICAgICAgICAgb3BlbkZpbGUgJiYgc05vdGUubm90ZS5wYXRoID09PSBvcGVuRmlsZS5wYXRoLFxuICAgICAgICAgICAgICAgICAgICAhdGhpcy5hY3RpdmVGb2xkZXJzLmhhcyhmb2xkZXJUaXRsZSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGVudEVsID0gdGhpcy5jb250YWluZXJFbC5jaGlsZHJlblsxXTtcbiAgICAgICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgICAgIGNvbnRlbnRFbC5hcHBlbmRDaGlsZChyb290RWwpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlUmlnaHRQYW5lRm9sZGVyKFxuICAgICAgICBwYXJlbnRFbDogYW55LFxuICAgICAgICBmb2xkZXJUaXRsZTogc3RyaW5nLFxuICAgICAgICBjb2xsYXBzZWQ6IGJvb2xlYW5cbiAgICApOiBhbnkge1xuICAgICAgICBjb25zdCBmb2xkZXJFbCA9IHBhcmVudEVsLmNyZWF0ZURpdihcIm5hdi1mb2xkZXJcIik7XG4gICAgICAgIGNvbnN0IGZvbGRlclRpdGxlRWwgPSBmb2xkZXJFbC5jcmVhdGVEaXYoXCJuYXYtZm9sZGVyLXRpdGxlXCIpO1xuICAgICAgICBjb25zdCBjaGlsZHJlbkVsID0gZm9sZGVyRWwuY3JlYXRlRGl2KFwibmF2LWZvbGRlci1jaGlsZHJlblwiKTtcbiAgICAgICAgY29uc3QgY29sbGFwc2VJY29uRWwgPSBmb2xkZXJUaXRsZUVsLmNyZWF0ZURpdihcbiAgICAgICAgICAgIFwibmF2LWZvbGRlci1jb2xsYXBzZS1pbmRpY2F0b3IgY29sbGFwc2UtaWNvblwiXG4gICAgICAgICk7XG4gICAgICAgIGNvbGxhcHNlSWNvbkVsLmlubmVySFRNTCA9IENPTExBUFNFX0lDT047XG5cbiAgICAgICAgaWYgKGNvbGxhcHNlZClcbiAgICAgICAgICAgIGNvbGxhcHNlSWNvbkVsLmNoaWxkTm9kZXNbMF0uc3R5bGUudHJhbnNmb3JtID0gXCJyb3RhdGUoLTkwZGVnKVwiO1xuXG4gICAgICAgIGZvbGRlclRpdGxlRWxcbiAgICAgICAgICAgIC5jcmVhdGVEaXYoXCJuYXYtZm9sZGVyLXRpdGxlLWNvbnRlbnRcIilcbiAgICAgICAgICAgIC5zZXRUZXh0KGZvbGRlclRpdGxlKTtcblxuICAgICAgICBmb2xkZXJUaXRsZUVsLm9uQ2xpY2tFdmVudCgoXzogYW55KSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBjaGlsZCBvZiBjaGlsZHJlbkVsLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLmRpc3BsYXkgPT0gXCJibG9ja1wiIHx8XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkLnN0eWxlLmRpc3BsYXkgPT0gXCJcIlxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxhcHNlSWNvbkVsLmNoaWxkTm9kZXNbMF0uc3R5bGUudHJhbnNmb3JtID1cbiAgICAgICAgICAgICAgICAgICAgICAgIFwicm90YXRlKC05MGRlZylcIjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hY3RpdmVGb2xkZXJzLmRlbGV0ZShmb2xkZXJUaXRsZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGQuc3R5bGUuZGlzcGxheSA9IFwiYmxvY2tcIjtcbiAgICAgICAgICAgICAgICAgICAgY29sbGFwc2VJY29uRWwuY2hpbGROb2Rlc1swXS5zdHlsZS50cmFuc2Zvcm0gPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZUZvbGRlcnMuYWRkKGZvbGRlclRpdGxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBjaGlsZHJlbkVsO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlUmlnaHRQYW5lRmlsZShcbiAgICAgICAgZm9sZGVyRWw6IGFueSxcbiAgICAgICAgZmlsZTogVEZpbGUsXG4gICAgICAgIGZpbGVFbEFjdGl2ZTogYm9vbGVhbixcbiAgICAgICAgaGlkZGVuOiBib29sZWFuXG4gICAgKSB7XG4gICAgICAgIGNvbnN0IG5hdkZpbGVFbCA9IGZvbGRlckVsLmNyZWF0ZURpdihcIm5hdi1maWxlXCIpO1xuICAgICAgICBpZiAoaGlkZGVuKSBuYXZGaWxlRWwuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiO1xuXG4gICAgICAgIGNvbnN0IG5hdkZpbGVUaXRsZSA9IG5hdkZpbGVFbC5jcmVhdGVEaXYoXCJuYXYtZmlsZS10aXRsZVwiKTtcbiAgICAgICAgaWYgKGZpbGVFbEFjdGl2ZSkgbmF2RmlsZVRpdGxlLmFkZENsYXNzKFwiaXMtYWN0aXZlXCIpO1xuXG4gICAgICAgIG5hdkZpbGVUaXRsZS5jcmVhdGVEaXYoXCJuYXYtZmlsZS10aXRsZS1jb250ZW50XCIpLnNldFRleHQoZmlsZS5iYXNlbmFtZSk7XG4gICAgICAgIG5hdkZpbGVUaXRsZS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgICAgXCJjbGlja1wiLFxuICAgICAgICAgICAgKGV2ZW50OiBNb3VzZUV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZi5vcGVuRmlsZShmaWxlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcblxuICAgICAgICBuYXZGaWxlVGl0bGUuYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICAgIFwiY29udGV4dG1lbnVcIixcbiAgICAgICAgICAgIChldmVudDogTW91c2VFdmVudCkgPT4ge1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZU1lbnUgPSBuZXcgTWVudSh0aGlzLmFwcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLnRyaWdnZXIoXG4gICAgICAgICAgICAgICAgICAgIFwiZmlsZS1tZW51XCIsXG4gICAgICAgICAgICAgICAgICAgIGZpbGVNZW51LFxuICAgICAgICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICAgICAgICBcIm15LWNvbnRleHQtbWVudVwiLFxuICAgICAgICAgICAgICAgICAgICBudWxsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBmaWxlTWVudS5zaG93QXRQb3NpdGlvbih7XG4gICAgICAgICAgICAgICAgICAgIHg6IGV2ZW50LnBhZ2VYLFxuICAgICAgICAgICAgICAgICAgICB5OiBldmVudC5wYWdlWSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmFsc2VcbiAgICAgICAgKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBOb3RpY2UsIFBsdWdpbiwgYWRkSWNvbiwgVEZpbGUsIEhlYWRpbmdDYWNoZSB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgKiBhcyBncmFwaCBmcm9tIFwicGFnZXJhbmsuanNcIjtcclxuaW1wb3J0IHsgU1JTZXR0aW5ncywgU1JTZXR0aW5nVGFiLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcclxuaW1wb3J0IHsgRmxhc2hjYXJkTW9kYWwgfSBmcm9tIFwiLi9mbGFzaGNhcmQtbW9kYWxcIjtcclxuaW1wb3J0IHsgUmV2aWV3UXVldWVMaXN0VmlldywgUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSB9IGZyb20gXCIuL3NpZGViYXJcIjtcclxuaW1wb3J0IHtcclxuICAgIENST1NTX0hBSVJTX0lDT04sXHJcbiAgICBTQ0hFRFVMSU5HX0lORk9fUkVHRVgsXHJcbiAgICBZQU1MX0ZST05UX01BVFRFUl9SRUdFWCxcclxuICAgIFNJTkdMRUxJTkVfQ0FSRF9SRUdFWCxcclxuICAgIE1VTFRJTElORV9DQVJEX1JFR0VYLFxyXG4gICAgQ0xPWkVfQ0FSRF9ERVRFQ1RPUixcclxuICAgIENMT1pFX0RFTEVUSU9OU19FWFRSQUNUT1IsXHJcbiAgICBDTE9aRV9TQ0hFRFVMSU5HX0VYVFJBQ1RPUixcclxufSBmcm9tIFwiLi9jb25zdGFudHNcIjtcclxuXHJcbmludGVyZmFjZSBQbHVnaW5EYXRhIHtcclxuICAgIHNldHRpbmdzOiBTUlNldHRpbmdzO1xyXG59XHJcblxyXG5jb25zdCBERUZBVUxUX0RBVEE6IFBsdWdpbkRhdGEgPSB7XHJcbiAgICBzZXR0aW5nczogREVGQVVMVF9TRVRUSU5HUyxcclxufTtcclxuXHJcbmludGVyZmFjZSBTY2hlZE5vdGUge1xyXG4gICAgbm90ZTogVEZpbGU7XHJcbiAgICBkdWVVbml4OiBudW1iZXI7XHJcbn1cclxuXHJcbmludGVyZmFjZSBMaW5rU3RhdCB7XHJcbiAgICBzb3VyY2VQYXRoOiBzdHJpbmc7XHJcbiAgICBsaW5rQ291bnQ6IG51bWJlcjtcclxufVxyXG5cclxuZW51bSBSZXZpZXdSZXNwb25zZSB7XHJcbiAgICBFYXN5LFxyXG4gICAgR29vZCxcclxuICAgIEhhcmQsXHJcbn1cclxuXHJcbi8qXHJcbiAgICBDYXJkIE9iamVjdFxyXG4gICAgVGhlcmUncyB0b28gbXVjaCBpbiBoZXJlLFxyXG4gICAgYnV0IG5ldmVyIHRlbGwgdGhlIHVzZXIgYWJvdXQgdGhpcyBhYm9taW5hdGlvbiEgeERcclxuKi9cclxuZXhwb3J0IGludGVyZmFjZSBDYXJkIHtcclxuICAgIGlzRHVlOiBib29sZWFuO1xyXG4gICAgZWFzZT86IG51bWJlcjtcclxuICAgIGludGVydmFsPzogbnVtYmVyO1xyXG4gICAgY29udGV4dD86IHN0cmluZztcclxuICAgIG5vdGU6IFRGaWxlO1xyXG4gICAgZnJvbnQ6IHN0cmluZztcclxuICAgIGJhY2s6IHN0cmluZztcclxuICAgIG1hdGNoOiBhbnk7XHJcbiAgICBpc1NpbmdsZUxpbmU6IGJvb2xlYW47XHJcbiAgICBpc0Nsb3plOiBib29sZWFuO1xyXG4gICAgY2xvemVEZWxldGlvbklkeD86IG51bWJlcjtcclxuICAgIHJlbGF0ZWRDYXJkcz86IENhcmRbXTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU1JQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xyXG4gICAgcHJpdmF0ZSBzdGF0dXNCYXI6IEhUTUxFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSByZXZpZXdRdWV1ZVZpZXc6IFJldmlld1F1ZXVlTGlzdFZpZXc7XHJcbiAgICBwdWJsaWMgZGF0YTogUGx1Z2luRGF0YTtcclxuXHJcbiAgICBwdWJsaWMgbmV3Tm90ZXM6IFRGaWxlW10gPSBbXTtcclxuICAgIHB1YmxpYyBzY2hlZHVsZWROb3RlczogU2NoZWROb3RlW10gPSBbXTtcclxuICAgIHByaXZhdGUgZWFzZUJ5UGF0aDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xyXG4gICAgcHJpdmF0ZSBpbmNvbWluZ0xpbmtzOiBSZWNvcmQ8c3RyaW5nLCBMaW5rU3RhdFtdPiA9IHt9O1xyXG4gICAgcHJpdmF0ZSBwYWdlcmFua3M6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcclxuICAgIHByaXZhdGUgZHVlTm90ZXNDb3VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBwdWJsaWMgbmV3Rmxhc2hjYXJkczogQ2FyZFtdID0gW107XHJcbiAgICBwdWJsaWMgZHVlRmxhc2hjYXJkczogQ2FyZFtdID0gW107XHJcblxyXG4gICAgYXN5bmMgb25sb2FkKCkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZFBsdWdpbkRhdGEoKTtcclxuXHJcbiAgICAgICAgYWRkSWNvbihcImNyb3NzaGFpcnNcIiwgQ1JPU1NfSEFJUlNfSUNPTik7XHJcblxyXG4gICAgICAgIHRoaXMuc3RhdHVzQmFyID0gdGhpcy5hZGRTdGF0dXNCYXJJdGVtKCk7XHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuY2xhc3NMaXN0LmFkZChcIm1vZC1jbGlja2FibGVcIik7XHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBcIk9wZW4gYSBub3RlIGZvciByZXZpZXdcIik7XHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbC1wb3NpdGlvblwiLCBcInRvcFwiKTtcclxuICAgICAgICB0aGlzLnN0YXR1c0Jhci5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKF86IGFueSkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnN5bmMoKTtcclxuICAgICAgICAgICAgdGhpcy5yZXZpZXdOZXh0Tm90ZSgpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJjcm9zc2hhaXJzXCIsIFwiUmV2aWV3IGZsYXNoY2FyZHNcIiwgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmZsYXNoY2FyZHNfc3luYygpO1xyXG4gICAgICAgICAgICBuZXcgRmxhc2hjYXJkTW9kYWwodGhpcy5hcHAsIHRoaXMpLm9wZW4oKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5yZWdpc3RlclZpZXcoXHJcbiAgICAgICAgICAgIFJFVklFV19RVUVVRV9WSUVXX1RZUEUsXHJcbiAgICAgICAgICAgIChsZWFmKSA9PlxyXG4gICAgICAgICAgICAgICAgKHRoaXMucmV2aWV3UXVldWVWaWV3ID0gbmV3IFJldmlld1F1ZXVlTGlzdFZpZXcobGVhZiwgdGhpcykpXHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmRhdGEuc2V0dGluZ3MuZGlzYWJsZUZpbGVNZW51UmV2aWV3T3B0aW9ucykge1xyXG4gICAgICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnUsIGZpbGU6IFRGaWxlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uc2V0VGl0bGUoXCJSZXZpZXc6IEVhc3lcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5zZXRJY29uKFwiY3Jvc3NoYWlyc1wiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9uQ2xpY2soKGV2dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWxlLmV4dGVuc2lvbiA9PSBcIm1kXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldmlld1Jlc3BvbnNlLkVhc3lcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5zZXRUaXRsZShcIlJldmlldzogR29vZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNldEljb24oXCJjcm9zc2hhaXJzXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAub25DbGljaygoZXZ0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbGUuZXh0ZW5zaW9uID09IFwibWRcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlUmV2aWV3UmVzcG9uc2UoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmV2aWV3UmVzcG9uc2UuR29vZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnNldFRpdGxlKFwiUmV2aWV3OiBIYXJkXCIpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2V0SWNvbihcImNyb3NzaGFpcnNcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKChldnQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNhdmVSZXZpZXdSZXNwb25zZShcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZXZpZXdSZXNwb25zZS5IYXJkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICAgICAgICBpZDogXCJub3RlLXJldmlldy1vcGVuLW5vdGVcIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcGVuIGEgbm90ZSBmb3IgcmV2aWV3XCIsXHJcbiAgICAgICAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN5bmMoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmV2aWV3TmV4dE5vdGUoKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6IFwibm90ZS1yZXZpZXctZWFzeVwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJldmlldyBub3RlIGFzIGVhc3lcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5GaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChvcGVuRmlsZSAmJiBvcGVuRmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKG9wZW5GaWxlLCBSZXZpZXdSZXNwb25zZS5FYXN5KTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6IFwibm90ZS1yZXZpZXctZ29vZFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJldmlldyBub3RlIGFzIGdvb2RcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5GaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChvcGVuRmlsZSAmJiBvcGVuRmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKG9wZW5GaWxlLCBSZXZpZXdSZXNwb25zZS5Hb29kKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kKHtcclxuICAgICAgICAgICAgaWQ6IFwibm90ZS1yZXZpZXctaGFyZFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJldmlldyBub3RlIGFzIGhhcmRcIixcclxuICAgICAgICAgICAgY2FsbGJhY2s6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW5GaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChvcGVuRmlsZSAmJiBvcGVuRmlsZS5leHRlbnNpb24gPT0gXCJtZFwiKVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVJldmlld1Jlc3BvbnNlKG9wZW5GaWxlLCBSZXZpZXdSZXNwb25zZS5IYXJkKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTUlNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcclxuXHJcbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmluaXRWaWV3KCk7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5zeW5jKCksIDIwMDApO1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZmxhc2hjYXJkc19zeW5jKCksIDIwMDApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIG9udW5sb2FkKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZVxyXG4gICAgICAgICAgICAuZ2V0TGVhdmVzT2ZUeXBlKFJFVklFV19RVUVVRV9WSUVXX1RZUEUpXHJcbiAgICAgICAgICAgIC5mb3JFYWNoKChsZWFmKSA9PiBsZWFmLmRldGFjaCgpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzeW5jKCkge1xyXG4gICAgICAgIGxldCBub3RlcyA9IHRoaXMuYXBwLnZhdWx0LmdldE1hcmtkb3duRmlsZXMoKTtcclxuXHJcbiAgICAgICAgZ3JhcGgucmVzZXQoKTtcclxuICAgICAgICB0aGlzLnNjaGVkdWxlZE5vdGVzID0gW107XHJcbiAgICAgICAgdGhpcy5lYXNlQnlQYXRoID0ge307XHJcbiAgICAgICAgdGhpcy5uZXdOb3RlcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuaW5jb21pbmdMaW5rcyA9IHt9O1xyXG4gICAgICAgIHRoaXMucGFnZXJhbmtzID0ge307XHJcbiAgICAgICAgdGhpcy5kdWVOb3Rlc0NvdW50ID0gMDtcclxuXHJcbiAgICAgICAgbGV0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgICAgZm9yIChsZXQgbm90ZSBvZiBub3Rlcykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pbmNvbWluZ0xpbmtzW25vdGUucGF0aF0gPT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICAgICAgdGhpcy5pbmNvbWluZ0xpbmtzW25vdGUucGF0aF0gPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGxldCBsaW5rcyA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUucmVzb2x2ZWRMaW5rc1tub3RlLnBhdGhdIHx8IHt9O1xyXG4gICAgICAgICAgICBmb3IgKGxldCB0YXJnZXRQYXRoIGluIGxpbmtzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pbmNvbWluZ0xpbmtzW3RhcmdldFBhdGhdID09IHVuZGVmaW5lZClcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nTGlua3NbdGFyZ2V0UGF0aF0gPSBbXTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBtYXJrZG93biBmaWxlcyBvbmx5XHJcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0UGF0aC5zcGxpdChcIi5cIikucG9wKCkudG9Mb3dlckNhc2UoKSA9PSBcIm1kXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmluY29taW5nTGlua3NbdGFyZ2V0UGF0aF0ucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZVBhdGg6IG5vdGUucGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGlua0NvdW50OiBsaW5rc1t0YXJnZXRQYXRoXSxcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZ3JhcGgubGluayhub3RlLnBhdGgsIHRhcmdldFBhdGgsIGxpbmtzW3RhcmdldFBhdGhdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgbGV0IGZpbGVDYWNoZWREYXRhID1cclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKG5vdGUpIHx8IHt9O1xyXG4gICAgICAgICAgICBsZXQgZnJvbnRtYXR0ZXIgPVxyXG4gICAgICAgICAgICAgICAgZmlsZUNhY2hlZERhdGEuZnJvbnRtYXR0ZXIgfHwgPFJlY29yZDxzdHJpbmcsIGFueT4+e307XHJcbiAgICAgICAgICAgIGxldCB0YWdzID0gZmlsZUNhY2hlZERhdGEudGFncyB8fCBbXTtcclxuXHJcbiAgICAgICAgICAgIGxldCBzaG91bGRJZ25vcmUgPSB0cnVlO1xyXG4gICAgICAgICAgICBmb3IgKGxldCB0YWdPYmogb2YgdGFncykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZGF0YS5zZXR0aW5ncy50YWdzVG9SZXZpZXcuaW5jbHVkZXModGFnT2JqLnRhZykpIHtcclxuICAgICAgICAgICAgICAgICAgICBzaG91bGRJZ25vcmUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGZyb250bWF0dGVyLnRhZ3MpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZnJvbnRtYXR0ZXIudGFncyA9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MudGFnc1RvUmV2aWV3LmluY2x1ZGVzKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIjXCIgKyBmcm9udG1hdHRlci50YWdzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3VsZElnbm9yZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB0YWcgb2YgZnJvbnRtYXR0ZXIudGFncykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MudGFnc1RvUmV2aWV3LmluY2x1ZGVzKFwiI1wiICsgdGFnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3VsZElnbm9yZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChzaG91bGRJZ25vcmUpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgLy8gZmlsZSBoYXMgbm8gc2NoZWR1bGluZyBpbmZvcm1hdGlvblxyXG4gICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICAhKFxyXG4gICAgICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItZHVlXCIpICYmXHJcbiAgICAgICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1pbnRlcnZhbFwiKSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItZWFzZVwiKVxyXG4gICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubmV3Tm90ZXMucHVzaChub3RlKTtcclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgZHVlVW5peDogbnVtYmVyID0gd2luZG93XHJcbiAgICAgICAgICAgICAgICAubW9tZW50KGZyb250bWF0dGVyW1wic3ItZHVlXCJdLCBbXHJcbiAgICAgICAgICAgICAgICAgICAgXCJERC1NTS1ZWVlZXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJkZGQgTU1NIEREIFlZWVlcIixcclxuICAgICAgICAgICAgICAgIF0pXHJcbiAgICAgICAgICAgICAgICAudmFsdWVPZigpO1xyXG4gICAgICAgICAgICB0aGlzLnNjaGVkdWxlZE5vdGVzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgIGR1ZVVuaXgsXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5lYXNlQnlQYXRoW25vdGUucGF0aF0gPSBmcm9udG1hdHRlcltcInNyLWVhc2VcIl07XHJcblxyXG4gICAgICAgICAgICBpZiAoZHVlVW5peCA8PSBub3cpIHRoaXMuZHVlTm90ZXNDb3VudCsrO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZ3JhcGgucmFuaygwLjg1LCAwLjAwMDAwMSwgKG5vZGU6IHN0cmluZywgcmFuazogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucGFnZXJhbmtzW25vZGVdID0gcmFuayAqIDEwMDAwO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBzb3J0IG5ldyBub3RlcyBieSBpbXBvcnRhbmNlXHJcbiAgICAgICAgdGhpcy5uZXdOb3RlcyA9IHRoaXMubmV3Tm90ZXMuc29ydChcclxuICAgICAgICAgICAgKGE6IFRGaWxlLCBiOiBURmlsZSkgPT5cclxuICAgICAgICAgICAgICAgICh0aGlzLnBhZ2VyYW5rc1tiLnBhdGhdIHx8IDApIC0gKHRoaXMucGFnZXJhbmtzW2EucGF0aF0gfHwgMClcclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyBzb3J0IHNjaGVkdWxlZCBub3RlcyBieSBkYXRlICYgd2l0aGluIHRob3NlIGRheXMsIHNvcnQgdGhlbSBieSBpbXBvcnRhbmNlXHJcbiAgICAgICAgdGhpcy5zY2hlZHVsZWROb3RlcyA9IHRoaXMuc2NoZWR1bGVkTm90ZXMuc29ydChcclxuICAgICAgICAgICAgKGE6IFNjaGVkTm90ZSwgYjogU2NoZWROb3RlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgcmVzdWx0ID0gYS5kdWVVbml4IC0gYi5kdWVVbml4O1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAhPSAwKSByZXR1cm4gcmVzdWx0O1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICAodGhpcy5wYWdlcmFua3NbYi5ub3RlLnBhdGhdIHx8IDApIC1cclxuICAgICAgICAgICAgICAgICAgICAodGhpcy5wYWdlcmFua3NbYS5ub3RlLnBhdGhdIHx8IDApXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgdGhpcy5zdGF0dXNCYXIuc2V0VGV4dChcclxuICAgICAgICAgICAgYFJldmlldzogJHt0aGlzLmR1ZU5vdGVzQ291bnR9IG5vdGVzLCAke3RoaXMuZHVlRmxhc2hjYXJkcy5sZW5ndGh9IGNhcmRzIGR1ZWBcclxuICAgICAgICApO1xyXG4gICAgICAgIHRoaXMucmV2aWV3UXVldWVWaWV3LnJlZHJhdygpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNhdmVSZXZpZXdSZXNwb25zZShub3RlOiBURmlsZSwgcmVzcG9uc2U6IFJldmlld1Jlc3BvbnNlKSB7XHJcbiAgICAgICAgbGV0IGZpbGVDYWNoZWREYXRhID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUobm90ZSkgfHwge307XHJcbiAgICAgICAgbGV0IGZyb250bWF0dGVyID0gZmlsZUNhY2hlZERhdGEuZnJvbnRtYXR0ZXIgfHwgPFJlY29yZDxzdHJpbmcsIGFueT4+e307XHJcblxyXG4gICAgICAgIGxldCB0YWdzID0gZmlsZUNhY2hlZERhdGEudGFncyB8fCBbXTtcclxuICAgICAgICBsZXQgc2hvdWxkSWdub3JlID0gdHJ1ZTtcclxuICAgICAgICBmb3IgKGxldCB0YWdPYmogb2YgdGFncykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhLnNldHRpbmdzLnRhZ3NUb1Jldmlldy5pbmNsdWRlcyh0YWdPYmoudGFnKSkge1xyXG4gICAgICAgICAgICAgICAgc2hvdWxkSWdub3JlID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHNob3VsZElnbm9yZSkge1xyXG4gICAgICAgICAgICBuZXcgTm90aWNlKFxyXG4gICAgICAgICAgICAgICAgXCJQbGVhc2UgdGFnIHRoZSBub3RlIGFwcHJvcHJpYXRlbHkgZm9yIHJldmlld2luZyAoaW4gc2V0dGluZ3MpLlwiXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBmaWxlVGV4dCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQobm90ZSk7XHJcbiAgICAgICAgbGV0IGVhc2UsIGludGVydmFsO1xyXG4gICAgICAgIC8vIG5ldyBub3RlXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAhKFxyXG4gICAgICAgICAgICAgICAgZnJvbnRtYXR0ZXIuaGFzT3duUHJvcGVydHkoXCJzci1kdWVcIikgJiZcclxuICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItaW50ZXJ2YWxcIikgJiZcclxuICAgICAgICAgICAgICAgIGZyb250bWF0dGVyLmhhc093blByb3BlcnR5KFwic3ItZWFzZVwiKVxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIGxldCBsaW5rVG90YWwgPSAwLFxyXG4gICAgICAgICAgICAgICAgbGlua1BHVG90YWwgPSAwLFxyXG4gICAgICAgICAgICAgICAgdG90YWxMaW5rQ291bnQgPSAwO1xyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgc3RhdE9iaiBvZiB0aGlzLmluY29taW5nTGlua3Nbbm90ZS5wYXRoXSkge1xyXG4gICAgICAgICAgICAgICAgbGV0IGVhc2UgPSB0aGlzLmVhc2VCeVBhdGhbc3RhdE9iai5zb3VyY2VQYXRoXTtcclxuICAgICAgICAgICAgICAgIGlmIChlYXNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGlua1RvdGFsICs9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRPYmoubGlua0NvdW50ICpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlcmFua3Nbc3RhdE9iai5zb3VyY2VQYXRoXSAqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGVhc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgbGlua1BHVG90YWwgKz1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wYWdlcmFua3Nbc3RhdE9iai5zb3VyY2VQYXRoXSAqIHN0YXRPYmoubGlua0NvdW50O1xyXG4gICAgICAgICAgICAgICAgICAgIHRvdGFsTGlua0NvdW50ICs9IHN0YXRPYmoubGlua0NvdW50O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgb3V0Z29pbmdMaW5rcyA9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLnJlc29sdmVkTGlua3Nbbm90ZS5wYXRoXSB8fCB7fTtcclxuICAgICAgICAgICAgZm9yIChsZXQgbGlua2VkRmlsZVBhdGggaW4gb3V0Z29pbmdMaW5rcykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGVhc2UgPSB0aGlzLmVhc2VCeVBhdGhbbGlua2VkRmlsZVBhdGhdO1xyXG4gICAgICAgICAgICAgICAgaWYgKGVhc2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBsaW5rVG90YWwgKz1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0Z29pbmdMaW5rc1tsaW5rZWRGaWxlUGF0aF0gKlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBhZ2VyYW5rc1tsaW5rZWRGaWxlUGF0aF0gKlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlYXNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGxpbmtQR1RvdGFsICs9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGFnZXJhbmtzW2xpbmtlZEZpbGVQYXRoXSAqXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dGdvaW5nTGlua3NbbGlua2VkRmlsZVBhdGhdO1xyXG4gICAgICAgICAgICAgICAgICAgIHRvdGFsTGlua0NvdW50ICs9IG91dGdvaW5nTGlua3NbbGlua2VkRmlsZVBhdGhdO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgbGlua0NvbnRyaWJ1dGlvbiA9XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MubWF4TGlua0ZhY3RvciAqXHJcbiAgICAgICAgICAgICAgICBNYXRoLm1pbigxLjAsIE1hdGgubG9nKHRvdGFsTGlua0NvdW50ICsgMC41KSAvIE1hdGgubG9nKDY0KSk7XHJcbiAgICAgICAgICAgIGVhc2UgPSBNYXRoLnJvdW5kKFxyXG4gICAgICAgICAgICAgICAgKDEuMCAtIGxpbmtDb250cmlidXRpb24pICogdGhpcy5kYXRhLnNldHRpbmdzLmJhc2VFYXNlICtcclxuICAgICAgICAgICAgICAgICAgICAodG90YWxMaW5rQ291bnQgPiAwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID8gKGxpbmtDb250cmlidXRpb24gKiBsaW5rVG90YWwpIC8gbGlua1BHVG90YWxcclxuICAgICAgICAgICAgICAgICAgICAgICAgOiBsaW5rQ29udHJpYnV0aW9uICogdGhpcy5kYXRhLnNldHRpbmdzLmJhc2VFYXNlKVxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBpbnRlcnZhbCA9IDE7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaW50ZXJ2YWwgPSBmcm9udG1hdHRlcltcInNyLWludGVydmFsXCJdO1xyXG4gICAgICAgICAgICBlYXNlID0gZnJvbnRtYXR0ZXJbXCJzci1lYXNlXCJdO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHJlc3BvbnNlICE9IFJldmlld1Jlc3BvbnNlLkdvb2QpIHtcclxuICAgICAgICAgICAgZWFzZSA9XHJcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9PSBSZXZpZXdSZXNwb25zZS5FYXN5XHJcbiAgICAgICAgICAgICAgICAgICAgPyBlYXNlICsgMjBcclxuICAgICAgICAgICAgICAgICAgICA6IE1hdGgubWF4KDEzMCwgZWFzZSAtIDIwKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChyZXNwb25zZSA9PSBSZXZpZXdSZXNwb25zZS5IYXJkKVxyXG4gICAgICAgICAgICBpbnRlcnZhbCA9IE1hdGgubWF4KFxyXG4gICAgICAgICAgICAgICAgMSxcclxuICAgICAgICAgICAgICAgIGludGVydmFsICogdGhpcy5kYXRhLnNldHRpbmdzLmxhcHNlc0ludGVydmFsQ2hhbmdlXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgZWxzZSBpZiAocmVzcG9uc2UgPT0gUmV2aWV3UmVzcG9uc2UuR29vZClcclxuICAgICAgICAgICAgaW50ZXJ2YWwgPSAoaW50ZXJ2YWwgKiBlYXNlKSAvIDEwMDtcclxuICAgICAgICBlbHNlIGludGVydmFsID0gKHRoaXMuZGF0YS5zZXR0aW5ncy5lYXN5Qm9udXMgKiBpbnRlcnZhbCAqIGVhc2UpIC8gMTAwO1xyXG5cclxuICAgICAgICAvLyBmdXp6XHJcbiAgICAgICAgaWYgKGludGVydmFsID49IDgpIHtcclxuICAgICAgICAgICAgbGV0IGZ1enogPSBbLTAuMDUgKiBpbnRlcnZhbCwgMCwgMC4wNSAqIGludGVydmFsXTtcclxuICAgICAgICAgICAgaW50ZXJ2YWwgKz0gZnV6eltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBmdXp6Lmxlbmd0aCldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpbnRlcnZhbCA9IE1hdGgucm91bmQoaW50ZXJ2YWwpO1xyXG5cclxuICAgICAgICBsZXQgZHVlID0gd2luZG93Lm1vbWVudChEYXRlLm5vdygpICsgaW50ZXJ2YWwgKiAyNCAqIDM2MDAgKiAxMDAwKTtcclxuICAgICAgICBsZXQgZHVlU3RyaW5nID0gZHVlLmZvcm1hdChcIkRELU1NLVlZWVlcIik7XHJcblxyXG4gICAgICAgIC8vIGNoZWNrIGlmIHNjaGVkdWxpbmcgaW5mbyBleGlzdHNcclxuICAgICAgICBpZiAoU0NIRURVTElOR19JTkZPX1JFR0VYLnRlc3QoZmlsZVRleHQpKSB7XHJcbiAgICAgICAgICAgIGxldCBzY2hlZHVsaW5nSW5mbyA9IFNDSEVEVUxJTkdfSU5GT19SRUdFWC5leGVjKGZpbGVUZXh0KTtcclxuICAgICAgICAgICAgZmlsZVRleHQgPSBmaWxlVGV4dC5yZXBsYWNlKFxyXG4gICAgICAgICAgICAgICAgU0NIRURVTElOR19JTkZPX1JFR0VYLFxyXG4gICAgICAgICAgICAgICAgYC0tLVxcbiR7c2NoZWR1bGluZ0luZm9bMV19c3ItZHVlOiAke2R1ZVN0cmluZ31cXG5zci1pbnRlcnZhbDogJHtpbnRlcnZhbH1cXG5zci1lYXNlOiAke2Vhc2V9XFxuJHtzY2hlZHVsaW5nSW5mb1s1XX0tLS1gXHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAvLyBuZXcgbm90ZSB3aXRoIGV4aXN0aW5nIFlBTUwgZnJvbnQgbWF0dGVyXHJcbiAgICAgICAgfSBlbHNlIGlmIChZQU1MX0ZST05UX01BVFRFUl9SRUdFWC50ZXN0KGZpbGVUZXh0KSkge1xyXG4gICAgICAgICAgICBsZXQgZXhpc3RpbmdZYW1sID0gWUFNTF9GUk9OVF9NQVRURVJfUkVHRVguZXhlYyhmaWxlVGV4dCk7XHJcbiAgICAgICAgICAgIGZpbGVUZXh0ID0gZmlsZVRleHQucmVwbGFjZShcclxuICAgICAgICAgICAgICAgIFlBTUxfRlJPTlRfTUFUVEVSX1JFR0VYLFxyXG4gICAgICAgICAgICAgICAgYC0tLVxcbiR7ZXhpc3RpbmdZYW1sWzFdfXNyLWR1ZTogJHtkdWVTdHJpbmd9XFxuc3ItaW50ZXJ2YWw6ICR7aW50ZXJ2YWx9XFxuc3ItZWFzZTogJHtlYXNlfVxcbi0tLWBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWxlVGV4dCA9IGAtLS1cXG5zci1kdWU6ICR7ZHVlU3RyaW5nfVxcbnNyLWludGVydmFsOiAke2ludGVydmFsfVxcbnNyLWVhc2U6ICR7ZWFzZX1cXG4tLS1cXG5cXG4ke2ZpbGVUZXh0fWA7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLmFwcC52YXVsdC5tb2RpZnkobm90ZSwgZmlsZVRleHQpO1xyXG5cclxuICAgICAgICBuZXcgTm90aWNlKFwiUmVzcG9uc2UgcmVjZWl2ZWQuXCIpO1xyXG5cclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5zeW5jKCk7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuc2V0dGluZ3MuYXV0b05leHROb3RlKSB0aGlzLnJldmlld05leHROb3RlKCk7XHJcbiAgICAgICAgfSwgNTAwKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyByZXZpZXdOZXh0Tm90ZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5kdWVOb3Rlc0NvdW50ID4gMCkge1xyXG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmRhdGEuc2V0dGluZ3Mub3BlblJhbmRvbU5vdGVcclxuICAgICAgICAgICAgICAgID8gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5kdWVOb3Rlc0NvdW50KVxyXG4gICAgICAgICAgICAgICAgOiAwO1xyXG4gICAgICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZi5vcGVuRmlsZShcclxuICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVkTm90ZXNbaW5kZXhdLm5vdGVcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubmV3Tm90ZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmRhdGEuc2V0dGluZ3Mub3BlblJhbmRvbU5vdGVcclxuICAgICAgICAgICAgICAgID8gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5uZXdOb3Rlcy5sZW5ndGgpXHJcbiAgICAgICAgICAgICAgICA6IDA7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmLm9wZW5GaWxlKHRoaXMubmV3Tm90ZXNbaW5kZXhdKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbmV3IE5vdGljZShcIllvdSdyZSBkb25lIGZvciB0aGUgZGF5IDpELlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBmbGFzaGNhcmRzX3N5bmMoKSB7XHJcbiAgICAgICAgbGV0IG5vdGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xyXG5cclxuICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHMgPSBbXTtcclxuICAgICAgICB0aGlzLmR1ZUZsYXNoY2FyZHMgPSBbXTtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgbm90ZSBvZiBub3Rlcykge1xyXG4gICAgICAgICAgICBsZXQgZmlsZUNhY2hlZERhdGEgPVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUobm90ZSkgfHwge307XHJcbiAgICAgICAgICAgIGxldCBmcm9udG1hdHRlciA9XHJcbiAgICAgICAgICAgICAgICBmaWxlQ2FjaGVkRGF0YS5mcm9udG1hdHRlciB8fCA8UmVjb3JkPHN0cmluZywgYW55Pj57fTtcclxuICAgICAgICAgICAgbGV0IHRhZ3MgPSBmaWxlQ2FjaGVkRGF0YS50YWdzIHx8IFtdO1xyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgdGFnT2JqIG9mIHRhZ3MpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0YWdPYmoudGFnID09IHRoaXMuZGF0YS5zZXR0aW5ncy5mbGFzaGNhcmRzVGFnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5maW5kRmxhc2hjYXJkcyhub3RlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGZyb250bWF0dGVyLnRhZ3MpIHtcclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZnJvbnRtYXR0ZXIudGFncyA9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkc1RhZyA9PVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiNcIiArIGZyb250bWF0dGVyLnRhZ3NcclxuICAgICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuZmluZEZsYXNoY2FyZHMobm90ZSk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHRhZyBvZiBmcm9udG1hdHRlci50YWdzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuc2V0dGluZ3MuZmxhc2hjYXJkc1RhZyA9PSBcIiNcIiArIHRhZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5maW5kRmxhc2hjYXJkcyhub3RlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnN0YXR1c0Jhci5zZXRUZXh0KFxyXG4gICAgICAgICAgICBgUmV2aWV3OiAke3RoaXMuZHVlTm90ZXNDb3VudH0gbm90ZXMsICR7dGhpcy5kdWVGbGFzaGNhcmRzLmxlbmd0aH0gY2FyZHMgZHVlYFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZmluZEZsYXNoY2FyZHMobm90ZTogVEZpbGUpIHtcclxuICAgICAgICBsZXQgZmlsZVRleHQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKG5vdGUpO1xyXG4gICAgICAgIGxldCBmaWxlQ2FjaGVkRGF0YSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0RmlsZUNhY2hlKG5vdGUpIHx8IHt9O1xyXG4gICAgICAgIGxldCBoZWFkaW5ncyA9IGZpbGVDYWNoZWREYXRhLmhlYWRpbmdzIHx8IFtdO1xyXG4gICAgICAgIGxldCBmaWxlQ2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBsZXQgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAvLyBiYXNpYyBjYXJkc1xyXG4gICAgICAgIGZvciAobGV0IHJlZ2V4IG9mIFtTSU5HTEVMSU5FX0NBUkRfUkVHRVgsIE1VTFRJTElORV9DQVJEX1JFR0VYXSkge1xyXG4gICAgICAgICAgICBsZXQgaXNTaW5nbGVMaW5lID0gcmVnZXggPT0gU0lOR0xFTElORV9DQVJEX1JFR0VYO1xyXG4gICAgICAgICAgICBmb3IgKGxldCBtYXRjaCBvZiBmaWxlVGV4dC5tYXRjaEFsbChyZWdleCkpIHtcclxuICAgICAgICAgICAgICAgIG1hdGNoWzBdID0gbWF0Y2hbMF0udHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgbWF0Y2hbMV0gPSBtYXRjaFsxXS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBtYXRjaFsyXSA9IG1hdGNoWzJdLnRyaW0oKTtcclxuXHJcbiAgICAgICAgICAgICAgICBsZXQgY2FyZE9iajogQ2FyZDtcclxuICAgICAgICAgICAgICAgIC8vIGZsYXNoY2FyZCBhbHJlYWR5IHNjaGVkdWxlZFxyXG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoWzNdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGR1ZVVuaXg6IG51bWJlciA9IHdpbmRvd1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAubW9tZW50KG1hdGNoWzNdLCBbXCJERC1NTS1ZWVlZXCIsIFwiZGRkIE1NTSBERCBZWVlZXCJdKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAudmFsdWVPZigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkdWVVbml4IDw9IG5vdykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkT2JqID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbnQ6IG1hdGNoWzFdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFjazogbWF0Y2hbMl0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3RlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNEdWU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnRlcnZhbDogcGFyc2VJbnQobWF0Y2hbNF0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWFzZTogcGFyc2VJbnQobWF0Y2hbNV0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2gsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc1NpbmdsZUxpbmUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0Nsb3plOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kdWVGbGFzaGNhcmRzLnB1c2goY2FyZE9iaik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXJkT2JqID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBmcm9udDogbWF0Y2hbMV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2s6IG1hdGNoWzJdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgaXNTaW5nbGVMaW5lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0R1ZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzQ2xvemU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uZXdGbGFzaGNhcmRzLnB1c2goY2FyZE9iaik7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgYWRkQ29udGV4dFRvQ2FyZChjYXJkT2JqLCBtYXRjaCwgaGVhZGluZ3MpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBjbG96ZSBkZWxldGlvbiBjYXJkc1xyXG4gICAgICAgIGZvciAobGV0IG1hdGNoIG9mIGZpbGVUZXh0Lm1hdGNoQWxsKENMT1pFX0NBUkRfREVURUNUT1IpKSB7XHJcbiAgICAgICAgICAgIG1hdGNoWzBdID0gbWF0Y2hbMF0udHJpbSgpO1xyXG5cclxuICAgICAgICAgICAgbGV0IGNhcmRUZXh0ID0gbWF0Y2hbMF07XHJcbiAgICAgICAgICAgIGxldCBkZWxldGlvbnMgPSBbLi4uY2FyZFRleHQubWF0Y2hBbGwoQ0xPWkVfREVMRVRJT05TX0VYVFJBQ1RPUildO1xyXG4gICAgICAgICAgICBsZXQgc2NoZWR1bGluZyA9IFsuLi5jYXJkVGV4dC5tYXRjaEFsbChDTE9aRV9TQ0hFRFVMSU5HX0VYVFJBQ1RPUildO1xyXG5cclxuICAgICAgICAgICAgLy8gd2UgaGF2ZSBzb21lIGV4dHJhIHNjaGVkdWxpbmcgZGF0ZXMgdG8gZGVsZXRlXHJcbiAgICAgICAgICAgIGlmIChzY2hlZHVsaW5nLmxlbmd0aCA+IGRlbGV0aW9ucy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIGxldCBpZHhTY2hlZCA9IGNhcmRUZXh0Lmxhc3RJbmRleE9mKFwiPCEtLVNSOlwiKSArIDc7XHJcbiAgICAgICAgICAgICAgICBsZXQgbmV3Q2FyZFRleHQgPSBjYXJkVGV4dC5zdWJzdHJpbmcoMCwgaWR4U2NoZWQpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWxldGlvbnMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3Q2FyZFRleHQgKz0gYCEke3NjaGVkdWxpbmdbaV1bMV19LCR7c2NoZWR1bGluZ1tpXVsyXX0sJHtzY2hlZHVsaW5nW2ldWzNdfWA7XHJcbiAgICAgICAgICAgICAgICBuZXdDYXJkVGV4dCArPSBcIi0tPlxcblwiO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCByZXBsYWNlbWVudFJlZ2V4ID0gbmV3IFJlZ0V4cChcclxuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIiksIC8vIGVzY2FwZSBzdHJpbmdcclxuICAgICAgICAgICAgICAgICAgICBcImdtXCJcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICBmaWxlVGV4dCA9IGZpbGVUZXh0LnJlcGxhY2UocmVwbGFjZW1lbnRSZWdleCwgbmV3Q2FyZFRleHQpO1xyXG4gICAgICAgICAgICAgICAgZmlsZUNoYW5nZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgcmVsYXRlZENhcmRzOiBDYXJkW10gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkZWxldGlvbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGxldCBjYXJkT2JqOiBDYXJkO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBkZWxldGlvblN0YXJ0ID0gZGVsZXRpb25zW2ldLmluZGV4O1xyXG4gICAgICAgICAgICAgICAgbGV0IGRlbGV0aW9uRW5kID0gZGVsZXRpb25TdGFydCArIGRlbGV0aW9uc1tpXVswXS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBsZXQgZnJvbnQgPVxyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0LnN1YnN0cmluZygwLCBkZWxldGlvblN0YXJ0KSArXHJcbiAgICAgICAgICAgICAgICAgICAgXCI8c3BhbiBzdHlsZT0nY29sb3I6IzIxOTZmMyc+Wy4uLl08L3NwYW4+XCIgK1xyXG4gICAgICAgICAgICAgICAgICAgIGNhcmRUZXh0LnN1YnN0cmluZyhkZWxldGlvbkVuZCk7XHJcbiAgICAgICAgICAgICAgICBmcm9udCA9IGZyb250LnJlcGxhY2UoLz09L2dtLCBcIlwiKTtcclxuICAgICAgICAgICAgICAgIGxldCBiYWNrID1cclxuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dC5zdWJzdHJpbmcoMCwgZGVsZXRpb25TdGFydCkgK1xyXG4gICAgICAgICAgICAgICAgICAgIFwiPHNwYW4gc3R5bGU9J2NvbG9yOiMyMTk2ZjMnPlwiICtcclxuICAgICAgICAgICAgICAgICAgICBjYXJkVGV4dC5zdWJzdHJpbmcoZGVsZXRpb25TdGFydCwgZGVsZXRpb25FbmQpICtcclxuICAgICAgICAgICAgICAgICAgICBcIjwvc3Bhbj5cIiArXHJcbiAgICAgICAgICAgICAgICAgICAgY2FyZFRleHQuc3Vic3RyaW5nKGRlbGV0aW9uRW5kKTtcclxuICAgICAgICAgICAgICAgIGJhY2sgPSBiYWNrLnJlcGxhY2UoLz09L2dtLCBcIlwiKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBjYXJkIGRlbGV0aW9uIHNjaGVkdWxlZFxyXG4gICAgICAgICAgICAgICAgaWYgKGkgPCBzY2hlZHVsaW5nLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBkdWVVbml4OiBudW1iZXIgPSB3aW5kb3dcclxuICAgICAgICAgICAgICAgICAgICAgICAgLm1vbWVudChzY2hlZHVsaW5nW2ldWzFdLCBcIkRELU1NLVlZWVlcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnZhbHVlT2YoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGR1ZVVuaXggPD0gbm93KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVlRmxhc2hjYXJkcy5wdXNoKGNhcmRPYmopO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXJkT2JqID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRHVlOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW50ZXJ2YWw6IHBhcnNlSW50KHNjaGVkdWxpbmdbaV1bMl0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWFzZTogcGFyc2VJbnQoc2NoZWR1bGluZ1tpXVszXSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzU2luZ2xlTGluZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0Nsb3plOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xvemVEZWxldGlvbklkeDogaSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIG5ldyBjYXJkXHJcbiAgICAgICAgICAgICAgICAgICAgY2FyZE9iaiA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2ssXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1NpbmdsZUxpbmU6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0R1ZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzQ2xvemU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb3plRGVsZXRpb25JZHg6IGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbGF0ZWRDYXJkcyxcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm5ld0ZsYXNoY2FyZHMucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZWxhdGVkQ2FyZHMucHVzaChjYXJkT2JqKTtcclxuICAgICAgICAgICAgICAgIGFkZENvbnRleHRUb0NhcmQoY2FyZE9iaiwgbWF0Y2gsIGhlYWRpbmdzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZpbGVDaGFuZ2VkKSBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkobm90ZSwgZmlsZVRleHQpO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGxvYWRQbHVnaW5EYXRhKCkge1xyXG4gICAgICAgIHRoaXMuZGF0YSA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfREFUQSwgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBzYXZlUGx1Z2luRGF0YSgpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgaW5pdFZpZXcoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoUkVWSUVXX1FVRVVFX1ZJRVdfVFlQRSkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRSaWdodExlYWYoZmFsc2UpLnNldFZpZXdTdGF0ZSh7XHJcbiAgICAgICAgICAgIHR5cGU6IFJFVklFV19RVUVVRV9WSUVXX1RZUEUsXHJcbiAgICAgICAgICAgIGFjdGl2ZTogdHJ1ZSxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gYWRkQ29udGV4dFRvQ2FyZChjYXJkT2JqOiBDYXJkLCBtYXRjaDogYW55LCBoZWFkaW5nczogSGVhZGluZ0NhY2hlW10pIHtcclxuICAgIGxldCBjYXJkT2Zmc2V0ID0gbWF0Y2guaW5kZXg7XHJcbiAgICBsZXQgc3RhY2s6IEhlYWRpbmdDYWNoZVtdID0gW107XHJcbiAgICBmb3IgKGxldCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XHJcbiAgICAgICAgaWYgKGhlYWRpbmcucG9zaXRpb24uc3RhcnQub2Zmc2V0ID4gY2FyZE9mZnNldCkgYnJlYWs7XHJcblxyXG4gICAgICAgIHdoaWxlIChcclxuICAgICAgICAgICAgc3RhY2subGVuZ3RoID4gMCAmJlxyXG4gICAgICAgICAgICBzdGFja1tzdGFjay5sZW5ndGggLSAxXS5sZXZlbCA+PSBoZWFkaW5nLmxldmVsXHJcbiAgICAgICAgKVxyXG4gICAgICAgICAgICBzdGFjay5wb3AoKTtcclxuXHJcbiAgICAgICAgc3RhY2sucHVzaChoZWFkaW5nKTtcclxuICAgIH1cclxuXHJcbiAgICBjYXJkT2JqLmNvbnRleHQgPSBcIlwiO1xyXG4gICAgZm9yIChsZXQgaGVhZGluZ09iaiBvZiBzdGFjaykgY2FyZE9iai5jb250ZXh0ICs9IGhlYWRpbmdPYmouaGVhZGluZyArIFwiID4gXCI7XHJcbiAgICBjYXJkT2JqLmNvbnRleHQgPSBjYXJkT2JqLmNvbnRleHQuc2xpY2UoMCwgLTMpO1xyXG59XHJcbiJdLCJuYW1lcyI6WyJQbHVnaW5TZXR0aW5nVGFiIiwiU2V0dGluZyIsIk5vdGljZSIsIk1vZGFsIiwiTWFya2Rvd25SZW5kZXJlciIsIkl0ZW1WaWV3IiwiTWVudSIsIlBsdWdpbiIsImFkZEljb24iLCJncmFwaC5yZXNldCIsImdyYXBoLmxpbmsiLCJncmFwaC5yYW5rIl0sIm1hcHBpbmdzIjoiOzs7O0FBRUEsU0FBUyxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUNsQyxJQUFJLElBQUksQ0FBQyxPQUFPLE1BQU0sS0FBSyxRQUFRLE1BQU0sT0FBTyxRQUFRLEtBQUssVUFBVSxDQUFDLEVBQUU7QUFDMUUsUUFBUSxLQUFLLElBQUksR0FBRyxJQUFJLE1BQU0sRUFBRTtBQUNoQyxZQUFZLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUU7QUFDckQsZ0JBQWdCLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLLEVBQUU7QUFDMUQsb0JBQW9CLE1BQU07QUFDMUIsaUJBQWlCO0FBQ2pCLGFBQWE7QUFDYixTQUFTO0FBQ1QsS0FBSztBQUNMLENBQUM7QUFDRDtBQUNBLE9BQWMsR0FBRyxDQUFDLFlBQVk7QUFDOUIsSUFBSSxJQUFJLElBQUksR0FBRztBQUNmLFFBQVEsS0FBSyxFQUFFLENBQUM7QUFDaEIsUUFBUSxLQUFLLEVBQUUsRUFBRTtBQUNqQixRQUFRLEtBQUssRUFBRSxFQUFFO0FBQ2pCLEtBQUssQ0FBQztBQUNOO0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFDbEQsUUFBUSxJ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
