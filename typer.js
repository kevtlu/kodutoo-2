console.log("Fail õigesti ühendatud");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getDatabase, ref, push, onValue, query, orderByChild, limitToFirst } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRXxsG0GHj_J6PBCVA7jt7lnE95_MPKxg",
  authDomain: "typer-d1815.firebaseapp.com",
  databaseURL: "https://typer-d1815-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "typer-d1815",
  storageBucket: "typer-d1815.firebasestorage.app",
  messagingSenderId: "1060331046219",
  appId: "1:1060331046219:web:c0e71b23bbe376d07d14ce"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getDatabase(app);

class Typer {
    constructor() {
        this.name = "";
        this.wordsInGame = 5;
        this.startingWordLength = 4;
        this.startTime = 0;
        this.endTime = 0;
        this.word = "Suvaline";
        this.words = [];
        this.typeWords = [];
        this.wordsTyped = 0;
        this.score = 0;

        const infoBox = document.getElementById("info");
        infoBox.innerHTML = `
            <div id="progressContainer"><div id="progressBar"></div></div>
            <div id="wordcount"></div>
            <div id="liveWpm">WPM: 0</div>
        `;

        this.audioStart = new Audio("start.mp3");
        this.audioType = new Audio("type.mp3");
        this.audioEnd = new Audio("end.mp3");
        this.audioScore = new Audio("score.mp3");

        this.startMenuClock();
        this.initFirebase();
        this.bindButtons();
        this.bindModal();
        this.loadFromFile();
    }

    startMenuClock() {
        const welcomeMsg = document.getElementById("welcomeMsg");
        const clockDiv = document.createElement("div");
        clockDiv.id = "menuClock";
        welcomeMsg.parentNode.insertBefore(clockDiv, welcomeMsg);

        setInterval(() => {
            const now = new Date();
            clockDiv.innerText = now.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }, 1000);
    }

    initFirebase() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.name = user.displayName;
                document.getElementById("authContainer").style.display = "none";
                document.getElementById("gameMenu").style.display = "flex";
                document.getElementById("welcomeMsg").innerText = `Tere, ${this.name}!`;
            } else {
                document.getElementById("authContainer").style.display = "flex";
                document.getElementById("gameMenu").style.display = "none";
            }
        });

        const scoresRef = query(ref(db, 'scores'), orderByChild('time'), limitToFirst(20));
        onValue(scoresRef, (snapshot) => {
            const container = document.getElementById("resultsContainer");
            
            let html = `
                <table class="results-table">
                    <thead>
                        <tr>
                            <th>Nimi</th>
                            <th>Aeg</th>
                            <th>WPM</th>
                            <th>Hinnang</th>
                        </tr>
                    </thead>
                    <tbody>`;

            snapshot.forEach((child) => {
                const data = child.val();
                const wpm = (data.speed * 60).toFixed(0);
                
                let rankIcon = "🐢";
                if(wpm > 35) rankIcon = "🚶";
                if(wpm > 55) rankIcon = "🏃";
                if(wpm > 80) rankIcon = "⚡";

                html += `
                    <tr>
                        <td><strong>${data.name}</strong></td>
                        <td>${data.time}s</td>
                        <td>${wpm}</td>
                        <td>${rankIcon}</td>
                    </tr>`;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        });
    }

    bindButtons() {
        document.getElementById("loginBtn").addEventListener("click", () => {
            signInWithPopup(auth, provider).catch(error => console.error("Sisselogimine ebaõnnestus:", error));
        });

        document.getElementById("logoutBtn").addEventListener("click", () => {
            signOut(auth).then(() => {
                this.resetGameState();
            });
        });

        document.getElementById("startGameBtn").addEventListener("click", () => {
            document.getElementById("gameMenu").style.display = "none";
            this.startCountdown();
        });

        document.getElementById("restartBtn").addEventListener("click", () => {
            this.resetGameState();
            this.startCountdown();
        });

        document.getElementById("backToMenuBtn").addEventListener("click", () => {
        this.resetGameState();
        document.getElementById("gameMenu").style.display = "flex";
        });
    }

    bindModal() {
        const modal = document.getElementById("resultsModal");
        const btn = document.getElementById("showResultsBtn");
        const span = document.querySelector(".close");

        btn.onclick = () => {
            modal.classList.add("is-visible");
        };

        span.onclick = () => {
            modal.classList.remove("is-visible");
        };

        window.onclick = (event) => {
            if (event.target == modal) {
                modal.classList.remove("is-visible");
            }
        };
    }

    async loadFromFile() {
        try {
            const responseFromFile = await fetch("lemmad2013.txt");
            const allWords = await responseFromFile.text();
            this.getWords(allWords);
        } catch(e) {
            console.error("Sõnastiku laadimine ebaõnnestus. Kontrolli, et lemmad2013.txt eksisteeriks.", e);
        }
    }

    getWords(data) {
        const dataFromFile = data.split("\n").map(word => word.trim()).filter(word => word.length > 0);
        this.separateWordsByLength(dataFromFile);
    }

    separateWordsByLength(words) {
        for (let word of words) {
            const wordLength = word.length;
            if (!this.words[wordLength]) {
                this.words[wordLength] = [];
            }
            this.words[wordLength].push(word);
        }
    }

    resetGameState() {
        this.wordsTyped = 0;
        this.typeWords = [];
        this.score = 0;
        document.getElementById("restartBtn").style.display = "none";
        document.getElementById("word").style.color = "black";
        document.getElementById("word").innerHTML = "";
        document.getElementById("info").style.display = "none";
        document.getElementById("wordContainer").style.display = "none";
    }

    startCountdown() {
        document.getElementById("counter").style.display = "flex";
        let i = 3;

        document.getElementById("time").innerHTML = i;

        let countdown = setInterval(() => {
            i--;
            if (i === 0) {
                document.getElementById("counter").style.display = "none";
                this.startTyper();
                clearInterval(countdown);
            } else {
                document.getElementById("time").innerHTML = i;
            }
        }, 1000);
    }

    startTyper() {
        this.audioStart.play();
        this.wordsTyped = 0;
        this.generateWords();
        this.upDateInfo();
        this.startTime = performance.now();
        document.querySelector("#info").style.display = "flex";
        document.querySelector("#wordContainer").style.display = "flex";

        this.startTime = performance.now();
        
        this.keyListener = (e) => {
            this.shorteWord(e.key);
        };

        window.addEventListener("keypress", this.keyListener);
    }

    shorteWord(keypressed) {
        if (this.word[0] === keypressed) {
            this.audioType.currentTime = 0;
            this.audioType.play();

            const totalChars = this.typeWords.join("").length;
            const typedChars = totalChars - this.word.length - (this.typeWords.slice(this.wordsTyped + 1).join("").length);
            const progressPercent = (typedChars / totalChars) * 100;
            document.getElementById("progressBar").style.width = progressPercent + "%";

            const currentTime = (performance.now() - this.startTime) / 1000 / 60;
            const currentWpm = Math.round((typedChars / 5) / currentTime) || 0;
            document.getElementById("liveWpm").innerText = `WPM: ${currentWpm}`;

            if (this.word.length > 1 && this.typeWords.length > this.wordsTyped) {
                this.word = this.word.slice(1);
                this.drawWord();
            } else if (this.word.length == 1 && this.wordsTyped <= this.typeWords.length - 2) {
                this.wordsTyped++;
                this.upDateInfo();
                this.selectWord();
            } else if (this.word.length == 1 && this.typeWords.length - 1 == this.wordsTyped) {
                this.upDateInfo();
                this.wordsTyped = 0;
                this.endGame();
            }
        } else if (this.word[0] != keypressed) {
            const wordElement = document.getElementById("word");
            wordElement.style.color = "#ef4444";
            wordElement.classList.add("shake");
            
            setTimeout(() => {
                wordElement.style.color = "#818cf8";
                wordElement.classList.remove("shake");
            }, 200);
        }
    }

    endGame() {
        this.audioEnd.play();
        this.endTime = performance.now();
        this.score = ((this.endTime - this.startTime) / 1000).toFixed(2);
        
        document.getElementById("word").innerHTML = `Mäng läbi. Sinu aeg on: ${this.score} sekundit.`;
        window.removeEventListener("keypress", this.keyListener);
        
        document.getElementById("restartBtn").style.display = "block";
        document.getElementById("backToMenuBtn").style.display = "block";
        
        this.saveResult();
    }

    saveResult() {
        if (this.score > 0) {
            const speed = (this.wordsInGame / parseFloat(this.score)).toFixed(2);
            push(ref(db, 'scores'), {
                name: this.name,
                time: parseFloat(this.score),
                words: this.typeWords.join(" "),
                speed: parseFloat(speed),
                timestamp: Date.now()
            }).then(() => {
                this.audioScore.play();
            }).catch(err => {
                console.error("Viga andmete salvestamisel:", err);
            });
        }
    }

    generateWords() {
        for (let i = 0; i < this.wordsInGame; i++) {
            const len = this.startingWordLength + i;
            if(this.words[len]) {
                const randomIndex = Math.floor(Math.random() * this.words[len].length);
                this.typeWords[i] = this.words[len][randomIndex];
            } else {
                this.typeWords[i] = "viga";
            }
        }
        this.selectWord();
    }

    selectWord() {
        this.word = this.typeWords[this.wordsTyped];
        this.drawWord();
    }

    drawWord() {
        document.getElementById("word").innerHTML = this.word;
    }

    upDateInfo() {
        document.getElementById("wordcount").innerHTML = `Sõnu trükitud: ${this.wordsTyped}/${this.wordsInGame}`;
    }
}

let typer = new Typer();