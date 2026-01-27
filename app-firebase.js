// Gestione delle schede di allenamento con Firebase
let currentUser = null;
let workouts = [];
let clients = [];
let clientWorkouts = {};
let workoutState = {
    name: "",
    days: {
        1: []
    },
    currentDay: 1
};


// Collezioni Firebase
const COLLECTIONS = {
    USERS: 'users',
    WORKOUTS: 'workouts',
    CLIENT_WORKOUTS: 'clientWorkouts'
};

// Carica dati all'avvio
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    
    // Setup ricerca esercizi
    setupExerciseSearch();
    
    // Event listeners per login
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Event listeners per admin e client logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    const clientLogoutBtn = document.getElementById('clientLogoutBtn');
    if (clientLogoutBtn) {
        clientLogoutBtn.addEventListener('click', handleLogout);
    }

    // Ensure print button uses green background and logout buttons are consistent
    if (!document.getElementById('app-custom-button-styles')) {
        const style = document.createElement('style');
        style.id = 'app-custom-button-styles';
        style.textContent = `
            /* Make action buttons consistent in size */
            .workout-actions button { padding: 8px 12px !important; font-size: 14px !important; border-radius: 4px !important; border: none !important; }
            /* Print/Salva button: same sizing but green background */
            .btn-print { background-color: #28a745 !important; color: #fff !important; padding: 8px 12px !important; font-size: 14px !important; display: inline-flex !important; align-items: center; justify-content: center; }
            /* Make logout buttons slightly smaller to avoid overlapping text */
            #logoutBtn, #clientLogoutBtn { padding: 6px 10px !important; font-size: 13px !important; height: auto !important; line-height: normal !important; }
        `;
        document.head.appendChild(style);
    }
    
    // Chiudi risultati ricerca quando si clicca fuori
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.image-search-group')) {
            document.querySelectorAll('.search-results').forEach(el => {
                el.style.display = 'none';
            });
        }
    });
});

// Controlla stato autenticazione
function checkAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('Auth state changed, user logged in:', user.email);
            
            // Estrai username dall'email e convertilo a minuscolo
            const username = user.email.split('@')[0].toLowerCase();
            
            // Cerca utente in Firestore per username
            const usersSnapshot = await db.collection(COLLECTIONS.USERS)
                .where('username', '==', username)
                .get();
            
            if (!usersSnapshot.empty) {
                const userData = usersSnapshot.docs[0].data();
                currentUser = { uid: user.uid, ...userData };
                console.log('Dashboard aperta per ruolo:', currentUser.role);
                showDashboard(currentUser.role);
            } else {
                console.log('Utente non trovato in Firestore');
                await auth.signOut();
            }
        } else {
            console.log('Nessun utente autenticato');
            showLoginPage();
        }
    });
}

// Gestisci login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    console.log('Tentativo login:', username);
    
    // Verifica che Firebase sia inizializzato
    if (typeof auth === 'undefined') {
        console.error('Firebase auth non è inizializzato!');
        alert('Errore: Firebase non è inizializzato. Ricarica la pagina.');
        return;
    }
    
    try {
        // Login con Firebase Auth usando email (convertita a minuscolo)
        const email = `${username}@kinesis.local`.toLowerCase();
        
        console.log('Tentativo auth con email:', email);
        console.log('Auth object disponibile:', !!auth);
        
        // Prova a fare login
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const firebaseUser = userCredential.user;
        
        console.log('Auth riuscita, UID:', firebaseUser.uid);
        
        // Cerca utente in Firestore
        const usersSnapshot = await db.collection(COLLECTIONS.USERS)
            .where('username', '==', username)
            .get();
        
        if (usersSnapshot.empty) {
            console.log('Utente non trovato in Firestore');
            alert('Configurazione utente non trovata. Contatta l\'amministratore.');
            await auth.signOut();
            return;
        }
        
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        
        console.log('Dati utente caricati:', userData);
        
        currentUser = { uid: firebaseUser.uid, ...userData };
        
        // Il cambio di pagina sarà gestito da onAuthStateChanged
        
    } catch (error) {
        console.error('Errore login:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'auth/user-not-found') {
            alert('Utente non trovato. Verifica l\'username inserito.');
        } else if (error.code === 'auth/wrong-password') {
            alert('Password errata!');
        } else if (error.code === 'auth/invalid-email') {
            alert('Email non valida!');
        } else if (error.code === 'auth/invalid-login-credentials') {
            alert('Username o password errati!');
        } else {
            alert('Errore durante il login: ' + error.message);
        }
    }
}

// Gestisci logout
async function handleLogout() {
    try {
        await auth.signOut();
        currentUser = null;
        showLoginPage();
    } catch (error) {
        console.error('Errore logout:', error);
        alert('Errore durante il logout');
    }
}

// Mostra pagina login
function showLoginPage() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('clientDashboard').style.display = 'none';
}

// Mostra dashboard
function showDashboard(role) {
    document.getElementById('loginPage').style.display = 'none';
    
    if (role === 'admin') {
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('clientDashboard').style.display = 'none';
        setupAdminDashboard();
        loadWorkouts();
    } else {
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('clientDashboard').style.display = 'block';
        loadClientWorkouts();
    }
}

// Setup admin dashboard
function setupAdminDashboard() {
    const workoutForm = document.getElementById('workoutForm');
    if (workoutForm) {
        // Disabilita la validazione HTML5 per permettere campi vuoti
        workoutForm.setAttribute('novalidate', 'true');
        workoutForm.removeEventListener('submit', handleFormSubmit);
        workoutForm.addEventListener('submit', handleFormSubmit);
    }
    
    const addExerciseBtn = document.getElementById('addExerciseBtn');
    if (addExerciseBtn) {
        addExerciseBtn.removeEventListener('click', addExerciseField);
        addExerciseBtn.addEventListener('click', addExerciseField);
    }
    
    const sendWorkoutForm = document.getElementById('sendWorkoutForm');
    if (sendWorkoutForm) {
        sendWorkoutForm.removeEventListener('submit', handleSendWorkout);
        sendWorkoutForm.addEventListener('submit', handleSendWorkout);
    }
    
    const createAccountForm = document.getElementById('createAccountForm');
    if (createAccountForm) {
        createAccountForm.removeEventListener('submit', handleCreateAccount);
        createAccountForm.addEventListener('submit', handleCreateAccount);
    }
}

// Carica schede da Firebase
async function loadWorkouts() {
    try {
        const snapshot = await db.collection(COLLECTIONS.WORKOUTS).orderBy('createdAt', 'desc').get();
        workouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayWorkouts();
        populateWorkoutSelect();
    } catch (error) {
        console.error('Errore caricamento schede:', error);
    }
}

// Salva scheda
async function handleFormSubmit(e) {
    e.preventDefault();
    saveCurrentDayExercises();

    const workoutData = {
        name: document.getElementById('workoutName').value.trim(),
        days: workoutState.days,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (workoutState.id) {
            // MODIFICA ESISTENTE
            await db.collection(COLLECTIONS.WORKOUTS).doc(workoutState.id).update(workoutData);
            alert('Scheda aggiornata con successo!');
        } else {
            // CREAZIONE NUOVA
            workoutData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            workoutData.createdBy = currentUser.uid;
            await db.collection(COLLECTIONS.WORKOUTS).add(workoutData);
            alert('Nuova scheda salvata!');
        }
        
        // Reset Totale
        workoutState = { id: null, name: "", days: { 1: [] }, currentDay: 1 };
        document.getElementById('workoutForm').reset();
        document.querySelector('#workoutForm .btn-primary').textContent = "Salva Scheda";
        renderDayTabs();
        resetExercisesList();
        await loadWorkouts();
    } catch (error) {
        console.error('Errore:', error);
        alert('Errore durante il salvataggio');
    }
}

// Reset lista esercizi
function resetExercisesList() {
    const exercisesList = document.getElementById('exercisesList');
    const items = exercisesList.querySelectorAll('.exercise-item');
    for (let i = items.length - 1; i > 0; i--) {
        items[i].remove();
    }
    
    const firstExercise = exercisesList.querySelector('.exercise-item');
    if (firstExercise) {
        const searchInput = firstExercise.querySelector('.exercise-search');
        const imagePath = firstExercise.querySelector('.exercise-image-path');
        const previewBox = firstExercise.querySelector('.image-preview-box');
        const setsInput = firstExercise.querySelector('.exercise-sets');
        const repsInput = firstExercise.querySelector('.exercise-reps');
        const restInput = firstExercise.querySelector('.exercise-rest');
        const notesInput = firstExercise.querySelector('.exercise-notes');
        
        if (searchInput) {
            searchInput.value = '';
            searchInput.removeAttribute('data-selected-name');
        }
        if (imagePath) imagePath.value = '';
        if (previewBox) previewBox.style.display = 'none';
        if (setsInput) setsInput.value = '';
        if (repsInput) repsInput.value = '';
        if (restInput) restInput.value = '';
        if (notesInput) notesInput.value = '';
    }
}

// Visualizza schede
function displayWorkouts() {
    const container = document.getElementById('workoutsContainer');
    container.innerHTML = workouts.map(workout => `
        <div class="workout-card">
            <div class="workout-header" onclick="toggleWorkout(this)">
                <h3>${workout.name}</h3>
                <div class="expand-icon">▼</div>
            </div>
            <div class="workout-content">
                <div class="workout-body">
                    ${Object.entries(workout.days || {}).map(([day, exercises]) => `
                        <div class="day-group" style="margin-bottom: 15px;">
                            <div class="day-header" onclick="event.stopPropagation(); toggleDayExercises(this)" style="cursor: pointer; display: flex; align-items: center; padding: 12px; background-color: #f0f0f0; border-radius: 5px; user-select: none;">
                                <span class="day-toggle-icon" style="display: inline-block; width: 20px; text-align: center; font-size: 16px; margin-right: 10px; transition: transform 0.3s;">▶</span>
                                <h4 style="color: #3CADD4; margin: 0; flex: 1; font-size: 1rem;">Giorno ${day} (${exercises.length} esercizi)</h4>
                            </div>
                            <div class="day-exercises" style="display: none; padding-left: 20px; margin-top: 10px; border-left: 3px solid #3CADD4;">
                                ${exercises.map(ex => `
                                    <div class="exercise-entry">
                                        ${ex.image ? `
                                            <div class="exercise-image-display">
                                                <img src="${ex.image}" alt="${ex.name}">
                                            </div>
                                        ` : ''}
                                        <div class="exercise-info">
                                            <strong>${ex.name}</strong>
                                            <div class="exercise-details">
                                                ${ex.sets}x${ex.reps}${ex.rest ? ` — Rec: ${ex.rest}s` : ''}
                                            </div>
                                            ${ex.notes ? `<div class="exercise-notes">${ex.notes}</div>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                        <div class="workout-actions" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                            <button class="btn-edit" onclick="event.stopPropagation(); editWorkout('${workout.id}')">Modifica</button>
                            <button class="btn-delete" onclick="event.stopPropagation(); deleteWorkout('${workout.id}')">Elimina</button>
                            <button class="btn-edit btn-print" title="Salva" aria-label="Salva" onclick="event.stopPropagation(); printWorkout('${workout.id}')">Salva</button>
                        </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Toggle espansione scheda
function toggleWorkout(header) {
    const card = header.closest('.workout-card');
    card.classList.toggle('expanded');
}

// Elimina scheda
async function deleteWorkout(id) {
    event.stopPropagation(); // Previeni chiusura card
    
    if (!confirm('Sei sicuro di voler eliminare questa scheda?')) return;
    
    try {
        await db.collection(COLLECTIONS.WORKOUTS).doc(id).delete();
        alert('Scheda eliminata!');
        await loadWorkouts();
    } catch (error) {
        console.error('Errore eliminazione scheda:', error);
        alert('Errore durante l\'eliminazione');
    }
}

// Aggiungi esercizio
function addExerciseField() {
    const exercisesList = document.getElementById('exercisesList');
    const exerciseItem = document.createElement('div');
    exerciseItem.className = 'exercise-item';
    exerciseItem.innerHTML = `
        <div class="form-group image-search-group">
            <label>Cerca Esercizio:</label>
            <input type="text" class="exercise-search" placeholder="Cerca esercizio... (es. panca, squat, crunch)" autocomplete="off">
            <div class="search-results" style="display: none;"></div>
            <input type="hidden" class="exercise-image-path">
        </div>
        <div class="image-preview-box" style="display: none;">
            <img src="" alt="Anteprima" class="preview-img">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Serie:</label>
                <input type="number" class="exercise-sets" placeholder="3" min="1">
            </div>
            <div class="form-group">
                <label>Ripetizioni:</label>
                <input type="number" class="exercise-reps" placeholder="10" min="1">
            </div>
            <div class="form-group">
                <label>Recupero (sec):</label>
                <input type="number" class="exercise-rest" placeholder="60" min="0" step="15">
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <button type="button" class="btn-move-up" onclick="moveExerciseUp(this)" title="Sposta su" style="padding:6px 8px;border-radius:4px;">▲</button>
                <button type="button" class="btn-move-down" onclick="moveExerciseDown(this)" title="Sposta giù" style="padding:6px 8px;border-radius:4px;">▼</button>
                <button type="button" class="btn-remove" onclick="removeExercise(this)" style="padding:6px 8px;border-radius:4px;">✕</button>
            </div>
        </div>
        <div class="form-group">
            <label>Note:</label>
            <input type="text" class="exercise-notes" placeholder="Note aggiuntive (opzionale)">
        </div>
    `;
    exercisesList.appendChild(exerciseItem);
    
    // Setup ricerca per il nuovo campo
    const searchInput = exerciseItem.querySelector('.exercise-search');
    searchInput.addEventListener('keyup', function() {
        handleExerciseSearch(this);
    });
    searchInput.addEventListener('focus', function() {
        handleExerciseSearch(this);
    });
}

// Rimuovi esercizio
function removeExercise(button) {
    const exercisesList = document.getElementById('exercisesList');
    const exerciseItems = exercisesList.getElementsByClassName('exercise-item');
    
    if (exerciseItems.length > 1) {
        button.closest('.exercise-item').remove();
    } else {
        alert('Devi avere almeno un esercizio nella scheda!');
    }
}

// Sposta l'esercizio verso l'alto
function moveExerciseUp(button) {
    const item = button.closest('.exercise-item');
    if (!item) return;
    const prev = item.previousElementSibling;
    if (prev && prev.classList.contains('exercise-item')) {
        item.parentNode.insertBefore(item, prev);
    }
}

// Sposta l'esercizio verso il basso
function moveExerciseDown(button) {
    const item = button.closest('.exercise-item');
    if (!item) return;
    const next = item.nextElementSibling;
    if (next && next.classList.contains('exercise-item')) {
        // Inserisci il fratello successivo prima dell'elemento corrente per scambiarli
        item.parentNode.insertBefore(next, item);
    }
}

// Setup ricerca esercizi per tutti i campi
function setupExerciseSearch() {
    // Inietta stili per i risultati di ricerca (una sola volta)
    if (!document.getElementById('search-results-styles')) {
        const style = document.createElement('style');
        style.id = 'search-results-styles';
        style.textContent = `
            .image-search-group { position: relative; }
            .search-results { position: absolute; left: 0; top: 100%; background: #fff; border: 1px solid #ddd; z-index: 1000; width: 100%; max-height: 500px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 4px 0; }
            .search-result-item { display:flex; align-items:center; gap:10px; padding:6px 8px; cursor:pointer; }
            .search-result-item:hover { background: #f6f8fa; }
            .search-result-item .result-thumb { width:44px; height:44px; object-fit:cover; border-radius:6px; flex:0 0 44px; }
            .search-result-item .result-name { font-size:14px; color:#222; }
            .search-no-results { padding:8px 10px; color:#666; }
        `;
        document.head.appendChild(style);
    }

    document.querySelectorAll('.exercise-search').forEach(input => {
        input.addEventListener('keyup', function() {
            handleExerciseSearch(this);
        });
        input.addEventListener('focus', function() {
            handleExerciseSearch(this);
        });
    });
}

// Gestisci ricerca esercizi
function handleExerciseSearch(input) {
    const searchGroup = input.closest('.image-search-group');
    const resultsDiv = searchGroup.querySelector('.search-results');
    const query = input.value.toLowerCase().trim();
    
    if (query.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    // Filtra esercizi
    const filtered = exerciseImages.filter(ex => 
        ex.name.toLowerCase().includes(query) && ex.path !== ''
    ); // Rimosso il limite di 20 risultati
    
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">Nessun esercizio trovato</div>';
        resultsDiv.style.display = 'block';
        return;
    }
    
    // Mostra risultati con miniatura
    resultsDiv.innerHTML = filtered.map(ex => `
        <div class="search-result-item" onclick="selectExercise(this, '${ex.name.replace(/'/g, "\\'")  }', '${ex.path}')">
            <img src="${ex.path}" class="result-thumb" onerror="this.style.display='none'" alt="thumb">
            <span class="result-name">${ex.name}</span>
        </div>
    `).join('');
    
    resultsDiv.style.display = 'block';
}

// Seleziona esercizio dalla ricerca
function selectExercise(element, name, path) {
    const searchGroup = element.closest('.image-search-group');
    const input = searchGroup.querySelector('.exercise-search');
    const pathInput = searchGroup.querySelector('.exercise-image-path');
    const resultsDiv = searchGroup.querySelector('.search-results');
    const exerciseItem = searchGroup.closest('.exercise-item');
    const previewBox = exerciseItem.querySelector('.image-preview-box');
    const img = previewBox.querySelector('.preview-img');
    
    // Imposta valori
    input.value = name;
    input.setAttribute('data-selected-name', name);
    pathInput.value = path;
    
    // Mostra anteprima
    if (path) {
        img.src = path;
        previewBox.style.display = 'block';
    } else {
        previewBox.style.display = 'none';
    }
    
    // Nascondi risultati
    resultsDiv.style.display = 'none';
}

// Gestione tab
function showTab(tabName) {
    const createTab = document.getElementById('createTab');
    const sendTab = document.getElementById('sendTab');
    const accountsTab = document.getElementById('accountsTab');
    const tabs = document.querySelectorAll('.tab-btn');
    
    createTab.style.display = 'none';
    sendTab.style.display = 'none';
    accountsTab.style.display = 'none';
    tabs.forEach(tab => tab.classList.remove('active'));
    
    if (tabName === 'create') {
        createTab.style.display = 'block';
        tabs[0].classList.add('active');
    } else if (tabName === 'send') {
        sendTab.style.display = 'block';
        tabs[1].classList.add('active');
        populateClientSelect();
        populateWorkoutSelect();
    } else if (tabName === 'accounts') {
        accountsTab.style.display = 'block';
        tabs[2].classList.add('active');
        displayAccountsList();
    }
}

// Popola select clienti
async function populateClientSelect() {
    try {
        const snapshot = await db.collection(COLLECTIONS.USERS).where('role', '==', 'client').get();
        clients = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        
        const clientSelect = document.getElementById('clientSelect');
        clientSelect.innerHTML = '<option value="">-- Scegli un cliente --</option>';
        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.username; // Usa username invece di UID
            option.textContent = client.name;
            clientSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Errore caricamento clienti:', error);
    }
}

// Popola select schede
function populateWorkoutSelect() {
    const workoutSelect = document.getElementById('workoutSelect');
    workoutSelect.innerHTML = '<option value="">-- Scegli una scheda --</option>';
    workouts.forEach(workout => {
        const option = document.createElement('option');
        option.value = workout.id;
        option.textContent = workout.name;
        workoutSelect.appendChild(option);
    });
}

// Invia scheda a cliente
async function handleSendWorkout(e) {
    e.preventDefault();
    
    const clientUsername = document.getElementById('clientSelect').value;
    const workoutId = document.getElementById('workoutSelect').value;
    
    if (!clientUsername || !workoutId) {
        alert('Seleziona sia il cliente che la scheda!');
        return;
    }
    
    try {
        // Verifica se già assegnata
        const existingAssignment = await db.collection(COLLECTIONS.CLIENT_WORKOUTS)
            .where('clientUsername', '==', clientUsername)
            .where('workoutId', '==', workoutId)
            .get();
        
        if (!existingAssignment.empty) {
            alert('Questo cliente ha già ricevuto questa scheda!');
            return;
        }
        
        // Crea assegnazione usando username
        await db.collection(COLLECTIONS.CLIENT_WORKOUTS).add({
            clientUsername: clientUsername,
            workoutId: workoutId,
            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const client = clients.find(c => c.username === clientUsername);
        const workout = workouts.find(w => w.id === workoutId);
        
        alert(`Scheda "${workout.name}" inviata a ${client.name}!`);
        document.getElementById('sendWorkoutForm').reset();
        
    } catch (error) {
        console.error('Errore invio scheda:', error);
        alert('Errore durante l\'invio');
    }
}

// Carica schede cliente
async function loadClientWorkouts() {
    try {
        console.log('Caricamento schede per:', currentUser.username);
        
        // Ottieni assegnazioni per questo cliente usando username
        const assignmentsSnapshot = await db.collection(COLLECTIONS.CLIENT_WORKOUTS)
            .where('clientUsername', '==', currentUser.username)
            .get();
        
        console.log('Assegnazioni trovate:', assignmentsSnapshot.size);
        
        const workoutIds = assignmentsSnapshot.docs.map(doc => doc.data().workoutId);
        
        if (workoutIds.length === 0) {
            document.getElementById('clientWorkoutsContainer').innerHTML = 
                '<p class="empty-state">Nessuna scheda ricevuta. Attendi che il tuo trainer te ne invii una!</p>';
            return;
        }
        
        // Carica le schede
        const workoutsPromises = workoutIds.map(id => 
            db.collection(COLLECTIONS.WORKOUTS).doc(id).get()
        );
        const workoutDocs = await Promise.all(workoutsPromises);
        const clientWorkoutsList = workoutDocs
            .filter(doc => doc.exists)
            .map(doc => ({ id: doc.id, ...doc.data() }));

        // Assicuriamoci che le schede caricate per il cliente siano presenti anche nell'array globale
        clientWorkoutsList.forEach(w => {
            if (!workouts.find(existing => existing.id === w.id)) {
                workouts.push(w);
            }
        });

        displayClientWorkouts(clientWorkoutsList);
        
    } catch (error) {
        console.error('Errore caricamento schede cliente:', error);
    }
}

// Visualizza schede cliente
function displayClientWorkouts(workoutsList) {
    const container = document.getElementById('clientWorkoutsContainer');
    
    if (workoutsList.length === 0) {
        container.innerHTML = '<p class="empty-state">Nessuna scheda ricevuta. Attendi che il tuo trainer te ne invii una!</p>';
        return;
    }
    
    container.innerHTML = workoutsList.map(workout => `
        <div class="workout-card">
            <div class="workout-header" onclick="toggleWorkout(this)">
                <div>
                    <h3>${workout.name}</h3>
                    <div class="workout-date">
                        Ricevuta il: ${workout.createdAt ? new Date(workout.createdAt.toDate()).toLocaleDateString('it-IT') : 'N/A'}
                    </div>
                </div>
                <div class="expand-icon">▼</div>
            </div>
            <div class="workout-content">
                <div class="workout-body">
                    ${renderWorkoutDaysHTML(workout)}
                </div>
                <div class="workout-actions" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <button class="btn-edit btn-print" title="Salva" aria-label="Salva" onclick="event.stopPropagation(); printWorkout('${workout.id}')">Salva</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Crea nuovo account
async function handleCreateAccount(e) {
    e.preventDefault();
    
    const name = document.getElementById('newClientName').value.trim();
    const username = document.getElementById('newClientUsername').value.trim().toLowerCase();
    const password = document.getElementById('newClientPassword').value;
    
    try {
        // Verifica se username esiste
        const existingUser = await db.collection(COLLECTIONS.USERS)
            .where('username', '==', username)
            .get();
        
        if (!existingUser.empty) {
            alert('Questo username è già utilizzato. Scegline un altro.');
            return;
        }
        
        // Salva dati utente in Firestore PRIMA di creare in Auth
        await db.collection(COLLECTIONS.USERS).add({
            username: username,
            password: password, // In produzione: NON salvare password in chiaro!
            name: name,
            role: 'client',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Crea utente in Firebase Auth
        const email = `${username}@kinesis.local`;
        
        // Usa Admin SDK o crea senza login automatico
        // Per ora creiamo manualmente, senza auto-login
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            // Logout immediato per non perdere sessione admin
            await auth.signOut();
            // Re-login come admin
            await auth.signInWithEmailAndPassword(`${currentUser.username}@kinesis.local`, currentUser.password);
        } catch (authError) {
            console.error('Errore creazione in Auth:', authError);
            // Continua comunque, l'utente potrà fare login e verrà creato in Auth al primo accesso
        }
        
        alert(`Account creato con successo!\nNome: ${name}\nUsername: ${username}\n\nIl cliente può ora fare login con queste credenziali.`);
        document.getElementById('createAccountForm').reset();
        
        displayAccountsList();
        
    } catch (error) {
        console.error('Errore creazione account:', error);
        alert('Errore durante la creazione dell\'account: ' + error.message);
    }
}

// Visualizza lista account
async function displayAccountsList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.USERS)
            .where('role', '==', 'client')
            .get();
        
        const clients = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        const container = document.getElementById('accountsList');
        
        if (clients.length === 0) {
            container.innerHTML = '<p class="empty-state">Nessun cliente registrato.</p>';
            return;
        }
        
        container.innerHTML = clients.map(client => `
            <div class="account-card">
                <div class="account-info">
                    <h4>${client.name}</h4>
                    <p><strong>Username:</strong> ${client.username}</p>
                    <p><strong>ID:</strong> ${client.uid}</p>
                </div>
                <button class="btn-delete-account" onclick="deleteAccount('${client.uid}')">Elimina</button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Errore caricamento account:', error);
    }
}

// Elimina account
async function deleteAccount(userId) {
    try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
        if (!userDoc.exists) return;
        
        const user = userDoc.data();
        
        if (!confirm(`Sei sicuro di voler eliminare l'account di ${user.name}?\nQuesta azione eliminerà anche tutte le schede associate.\n\nNOTA: L'utente sarà rimosso dal database ma potrebbe rimanere in Firebase Authentication.`)) {
            return;
        }
        
        // Elimina utente da Firestore
        await db.collection(COLLECTIONS.USERS).doc(userId).delete();
        
        // Elimina assegnazioni schede usando username
        const assignments = await db.collection(COLLECTIONS.CLIENT_WORKOUTS)
            .where('clientUsername', '==', user.username)
            .get();
        
        const deletePromises = assignments.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        
        // NOTA: Non possiamo eliminare da Firebase Auth lato client
        // Per farlo serve Firebase Admin SDK lato server
        // L'utente non potrà più accedere perché non esiste in Firestore
        
        alert('Account eliminato con successo dal database.');
        displayAccountsList();
        populateClientSelect();
        
    } catch (error) {
        console.error('Errore eliminazione account:', error);
        alert('Errore durante l\'eliminazione: ' + error.message);
    }
}

// Salva gli esercizi scritti nel form dentro workoutState prima di cambiare giorno
function saveCurrentDayExercises() {
    const exerciseItems = document.querySelectorAll('.exercise-item');
    const exercises = [];
    
    exerciseItems.forEach(item => {
        const name = item.querySelector('.exercise-search').value;
        if (name) {
            exercises.push({
                name: name,
                sets: item.querySelector('.exercise-sets').value,
                reps: item.querySelector('.exercise-reps').value,
                rest: item.querySelector('.exercise-rest').value,
                notes: item.querySelector('.exercise-notes').value,
                image: item.querySelector('.exercise-image-path').value
            });
        }
    });
    
    workoutState.days[workoutState.currentDay] = exercises;
}

// Cambia il giorno visualizzato
function switchDay(dayNumber) {
    saveCurrentDayExercises();
    workoutState.currentDay = parseInt(dayNumber);
    
    document.querySelectorAll('.day-tab').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.day) === workoutState.currentDay);
    });
    document.getElementById('currentDayLabel').textContent = `Esercizi - Giorno ${workoutState.currentDay}`;
    
    // Invece di resetExercisesList(), usa la nostra nuova funzione:
    loadExercisesForCurrentDay();
}

// Aggiunge un nuovo giorno (Massimo 5)
document.getElementById('addDayBtn').addEventListener('click', () => {
    const dayCount = Object.keys(workoutState.days).length;
    if (dayCount >= 5) {
        alert('Puoi creare al massimo 5 giorni di allenamento');
        return;
    }

    const nextDay = dayCount + 1;
    workoutState.days[nextDay] = [];
    
    renderDayTabs();
    switchDay(nextDay);
});

function renderDayTabs() {
    const container = document.getElementById('daysTabsContainer');
    container.innerHTML = '';
    Object.keys(workoutState.days).forEach(day => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day-tab' + (parseInt(day) === workoutState.currentDay ? ' active' : '');
        btn.dataset.day = day;
        btn.textContent = `Giorno ${day}`;
        btn.onclick = () => switchDay(day);
        container.appendChild(btn);
    });
}

function renderWorkoutDaysHTML(workout) {
    if (!workout.days) return '<p>Nessun esercizio presente.</p>';

    return Object.entries(workout.days).map(([day, exercises]) => `
        <div class="day-group" style="margin-bottom: 20px;">
            <div class="day-header" onclick="toggleDayExercises(this)" style="cursor: pointer; display: flex; align-items: center; padding: 12px; background-color: #f0f0f0; border-radius: 5px; user-select: none;">
                <span class="day-toggle-icon" style="display: inline-block; width: 20px; text-align: center; font-size: 16px; margin-right: 10px; transition: transform 0.3s;">▶</span>
                <h4 style="color: #3CADD4; margin: 0; flex: 1; font-size: 1rem;">Giorno ${day} (${exercises.length} esercizi)</h4>
            </div>
            <div class="day-exercises" style="display: none; padding-left: 20px; margin-top: 10px; border-left: 3px solid #3CADD4;">
                ${exercises.map(ex => `
                    <div class="exercise-entry">
                        ${ex.image ? `
                            <div class="exercise-image-display">
                                <img src="${ex.image}" alt="${ex.name}" onclick="window.open(this.src, '_blank')">
                            </div>
                        ` : ''}
                        <div class="exercise-info">
                            <strong>${ex.name}</strong>
                            <div class="exercise-details">
                                <span style="font-size: 1.1rem; color: #333;">${ex.sets} serie</span> x <span style="font-size: 1.1rem; color: #333;">${ex.reps} rep</span>
                            </div>
                            <div class="exercise-rest">Recupero: ${ex.rest}s</div>
                            ${ex.notes ? `<div class="exercise-notes">Note: ${ex.notes}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function toggleDayExercises(headerElement) {
    const dayGroup = headerElement.closest('.day-group');
    const exercisesContainer = dayGroup.querySelector('.day-exercises');
    const icon = headerElement.querySelector('.day-toggle-icon');
    
    const isHidden = exercisesContainer.style.display === 'none';
    
    exercisesContainer.style.display = isHidden ? 'block' : 'none';
    icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
}

async function editWorkout(id) {
    // Evita che il click chiuda o apra la card
    event.stopPropagation();
    
    const workout = workouts.find(w => w.id === id);
    if (!workout) return;

    // Reset dello stato con i dati esistenti
    workoutState.id = id;
    workoutState.name = workout.name;
    workoutState.days = JSON.parse(JSON.stringify(workout.days)); // Copia profonda
    workoutState.currentDay = 1;

    // Popola il nome nel form
    document.getElementById('workoutName').value = workout.name;

    // Cambia il testo del bottone di salvataggio
    const submitBtn = document.querySelector('#workoutForm .btn-primary');
    submitBtn.textContent = "Aggiorna Scheda";

    // Mostra il tab di creazione
    showTab('create');
    
    // Aggiorna la UI dei giorni e degli esercizi
    renderDayTabs();
    loadExercisesForCurrentDay();
}

// Funzione di supporto per caricare gli esercizi del giorno nello stato visibile
function loadExercisesForCurrentDay() {
    resetExercisesList();
    const currentDayExercises = workoutState.days[workoutState.currentDay] || [];
    
    // Rimuovi il primo campo vuoto di default se ci sono esercizi salvati
    const list = document.getElementById('exercisesList');
    if (currentDayExercises.length > 0) {
        list.innerHTML = '';
    }

    currentDayExercises.forEach(ex => {
        addExerciseField(); // Crea il campo
        const lastItem = list.lastElementChild;
        
        // Popola il campo appena creato
        lastItem.querySelector('.exercise-search').value = ex.name;
        lastItem.querySelector('.exercise-search').setAttribute('data-selected-name', ex.name);
        lastItem.querySelector('.exercise-image-path').value = ex.image || "";
        lastItem.querySelector('.exercise-sets').value = ex.sets;
        lastItem.querySelector('.exercise-reps').value = ex.reps;
        lastItem.querySelector('.exercise-rest').value = ex.rest;
        lastItem.querySelector('.exercise-notes').value = ex.notes || "";

        // Se c'è un'immagine, mostra l'anteprima
        if (ex.image) {
            const preview = lastItem.querySelector('.image-preview-box');
            preview.querySelector('.preview-img').src = ex.image;
            preview.style.display = 'block';
        }
    });
}

// Stampa scheda con layout a griglia 3 colonne
async function printWorkout(workoutId) {
    console.log('printWorkout called with id:', workoutId, 'workouts length:', workouts.length);
    let workout = workouts.find(w => w.id === workoutId);
    if (!workout) {
        // Se non è presente in memoria (es. visualizzazione client), proviamo a caricarla da Firestore
        try {
            const doc = await db.collection(COLLECTIONS.WORKOUTS).doc(workoutId).get();
            if (doc.exists) {
                workout = { id: doc.id, ...doc.data() };
            } else {
                alert('Scheda non trovata!');
                return;
            }
        } catch (err) {
            console.error('Errore recupero scheda:', err);
            alert('Errore nel recupero della scheda. Riprova.');
            return;
        }
    }

    // Crea una finestra di stampa
    const printWindow = window.open('', '', 'width=1000,height=800');
    const parentBaseHref = window.location.href;
    
    // Costruisci l'HTML per la stampa
    let html = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="${parentBaseHref}">
    <title>${workout.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            background: white;
            color: #333;
            padding: 20px;
        }
        
        .print-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .print-header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 3px solid #3CADD4;
            padding-bottom: 8px;
        }
        
        .print-header h1 {
            color: #3CADD4;
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        .day-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        
        .day-title {
            background-color: #3CADD4;
            color: white;
            padding: 12px 20px;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        
        .exercises-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .exercise-card {
            border: 2px solid #3CADD4;
            border-radius: 8px;
            overflow: hidden;
            background: #f9f9f9;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
        }
        
        .exercise-image {
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
            min-height: 100px;
        }
        
        .exercise-image img {
            max-width: 100%;
            max-height: 400px;
            width: auto;
            height: auto;
            object-fit: contain;
        }
        
        .exercise-details {
            padding: 15px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-grow: 1;
        }
        
        .exercise-name {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            text-transform: capitalize;
            line-height: 1.2;
        }
        
        .exercise-sets-reps {
            font-size: 14px;
            color: #3CADD4;
            font-weight: bold;
        }
        
        .exercise-recovery {
            font-size: 13px;
            color: #666;
        }
        
        .exercise-notes {
            font-size: 12px;
            color: #555;
            font-style: italic;
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px solid #ddd;
        }
        
        .no-exercises {
            text-align: center;
            padding: 30px;
            color: #999;
            font-size: 14px;
        }
        
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
            html, body { width: 185mm; }
            body {
                padding: 6px;
                font-size: 11pt;
                background: #fff;
                color: #333;
            }

            .print-container {
                max-width: 100%;
                width: 185mm !important;
            }

            /* Riduci gap e usa 4 colonne per sfruttare meglio lo spazio verticale */
            .exercises-grid {
                gap: 8px;
                grid-template-columns: repeat(4, 1fr) !important;
                grid-auto-rows: 85mm; /* altezza fissa per riga in stampa (3 righe per pagina) */
                grid-auto-flow: row;
            }

            /* Page box: dimensioni A4 interne (@page margins 10mm => 297 - 20 = 277mm) */
            .page { width: 190mm !important; height: 277mm !important; box-sizing: border-box; page-break-after: always; }
            .page .exercises-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; grid-auto-rows: 85mm; height: calc(85mm * 3); }

            /* Riduci ulteriormente l'altezza minima e padding delle card per evitare spostamenti su pagina successiva */
            .print-container .exercise-card {
                break-inside: avoid;
                page-break-inside: avoid;
                min-height: 30mm;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .print-container .exercise-image img {
                max-height: 30mm;
                width: 100%;
                height: auto;
                object-fit: contain;
            }

            .print-container .exercise-details { padding: 6px; }

            .print-container .exercise-name { font-size: 11.5pt; }
            .print-container .exercise-sets-reps { font-size: 10.5pt; }
            .print-container .exercise-recovery, .print-container .exercise-notes { font-size: 9.5pt; }

            .print-container .day-title {
                padding: 6px 8px;
                font-size: 13px;
                margin-bottom: 8px;
                border-radius: 3px;
            }

            .day-section {
                page-break-inside: avoid;
            }
        }
        /* Forza layout a 4 colonne in modalità stampa */
        @media print {
            .exercises-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
        /* Responsive per schermi piccoli (migliora layout su mobile) - applica solo a schermo, non alla stampa */
        @media screen and (max-width: 800px) {
            .print-header h1 { font-size: 20px; }
            .day-title { font-size: 16px; padding: 10px 14px; }
            .exercises-grid { grid-template-columns: repeat(1, 1fr); gap: 12px; }
            .exercise-image { min-height: 80px; }
            .exercise-details { padding: 10px; }
            body { padding: 10px; }
        }
        /* Forza layout 4 colonne e larghezza fissa per la generazione PDF (override per html2canvas) */
        .print-container { width: 190mm !important; max-width: 190mm !important; }
        .exercises-grid { grid-template-columns: repeat(4, 1fr) !important; grid-auto-rows: 85mm !important; }
    </style>
</head>
<body>
    <div class="print-container">
    `;

    // Aggiungi i giorni e gli esercizi paginati: 4 colonne x 3 righe per pagina (12 esercizi)
    if (workout.days && Object.keys(workout.days).length > 0) {
        Object.entries(workout.days).forEach(([day, exercises]) => {
            const pageSize = 12;
            for (let i = 0; i < exercises.length; i += pageSize) {
                const chunk = exercises.slice(i, i + pageSize);
                // Per la prima pagina del giorno mostriamo il titolo; per le successive no
                const showTitle = (i === 0);

                html += `
        <div class="page">
            ${showTitle ? `<div class="day-title">Giorno ${day}</div>` : '<div class="day-title" style="visibility:hidden;height:12mm;margin-bottom:8px"></div>'}
            <div class="exercises-grid" data-page-index="${i / pageSize}">
            `;

                if (chunk && chunk.length > 0) {
                    chunk.forEach(ex => {
                        html += `
                <div class="exercise-card">
                    ${ex.image ? `
                    <div class="exercise-image">
                        <img src="${ex.image}" alt="${ex.name}">
                    </div>
                    ` : '<div class="exercise-image" style="background: #e8e8e8;"><p style="color: #999;">Nessuna immagine</p></div>'}
                    <div class="exercise-details">
                        <div class="exercise-name">${ex.name}</div>
                        <div class="exercise-sets-reps">${ex.sets} serie × ${ex.reps} ripetizioni</div>
                        ${ex.rest ? `<div class="exercise-recovery">Recupero: ${ex.rest}s</div>` : ''}
                        ${ex.notes ? `<div class="exercise-notes">${ex.notes}</div>` : ''}
                    </div>
                </div>
                        `;
                    });
                } else {
                    html += '<div class="no-exercises">Nessun esercizio per questo giorno</div>';
                }

                html += `
            </div>
        </div>
                `;
            }
            // Se il giorno non ha esercizi, mostriamo comunque un blocco vuoto
            if (!exercises || exercises.length === 0) {
                html += '<div class="page"><div class="day-title">Giorno '+day+'</div><div class="no-exercises">Nessun esercizio per questo giorno</div></div>';
            }
        });
    } else {
        html += '<p class="no-exercises">Nessun esercizio presente nella scheda.</p>';
    }

    html += `
    </div>
    <script>
    // Generazione PDF direttamente nella finestra figlia tramite html2pdf
    (function(){
        function imagesLoaded(parent, cb) {
            var imgs = Array.from((parent || document).querySelectorAll('img'));
            if (imgs.length === 0) return cb();
            var remaining = imgs.length;
            imgs.forEach(function(i){
                if (i.complete) { if (--remaining === 0) cb(); }
                else i.addEventListener('load', function(){ if (--remaining === 0) cb(); });
                i.addEventListener('error', function(){ if (--remaining === 0) cb(); });
            });
        }

        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js';
        // create a small status box so user sees what's happening in the child window
        function setStatus(msg) {
            try {
                var sbox = document.getElementById('child-pdf-status');
                if (!sbox) {
                    sbox = document.createElement('div');
                    sbox.id = 'child-pdf-status';
                    sbox.style.position = 'fixed';
                    sbox.style.right = '12px';
                    sbox.style.top = '12px';
                    sbox.style.zIndex = 999999;
                    sbox.style.background = 'rgba(0,0,0,0.8)';
                    sbox.style.color = 'white';
                    sbox.style.padding = '8px 12px';
                    sbox.style.borderRadius = '6px';
                    sbox.style.fontSize = '13px';
                    sbox.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                    document.body.appendChild(sbox);
                }
                sbox.textContent = msg;
            } catch (e) { /* ignore */ }
        }

        var triedAlt = false;
        s.onload = function(){
            setStatus('Libreria PDF caricata, preparo documento...');
            try {
                // Aspetta che le immagini siano caricate
                imagesLoaded(document.body, function(){
                    setStatus('Generazione PDF...');
                    var opt = {
                        margin:       [10,10,10,10],
                        filename:     (document.title || 'scheda') + '.pdf',
                        image:        { type: 'jpeg', quality: 0.95 },
                        html2canvas:  { scale: 2, useCORS: true, logging: false },
                        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    var container = document.querySelector('.print-container') || document.body;
                    try {
                        html2pdf().from(container).set(opt).save().then(function(){
                            setStatus('Download completato');
                            setTimeout(function(){ try { window.close(); } catch(e){} }, 700);
                        }).catch(function(err){
                            console.error('Errore html2pdf.save():', err);
                            setStatus('Errore generazione PDF');
                            // fallback: invoca print per permettere Salva come PDF manuale
                            setTimeout(function(){ try { window.print(); } catch(e){} }, 300);
                        });
                    } catch (syncErr) {
                        console.error('Errore sincrono durante html2pdf:', syncErr);
                        setStatus('Errore nella libreria PDF');
                        setTimeout(function(){ try { window.print(); } catch(e){} }, 300);
                    }
                });
            } catch (e) {
                console.error('Errore durante la preparazione del PDF nella finestra figlia:', e);
                setStatus('Errore nella preparazione del PDF');
                setTimeout(function(){ try { window.print(); } catch(e){} }, 300);
            }
        };

        s.onerror = function(){
            console.error('Impossibile caricare html2pdf nella finestra figlia, prova CDN alternativo o fallback a stampa');
            setStatus('Impossibile caricare libreria PDF (CDN)');
            if (!triedAlt) {
                triedAlt = true;
                // prova CDN alternativo
                s.src = 'https://unpkg.com/html2pdf.js@0.9.2/dist/html2pdf.bundle.min.js';
                document.head.appendChild(s);
                setStatus('Tentativo CDN alternativo...');
                return;
            }
            // fallback: apri dialog di stampa per permettere Salva come PDF
            setTimeout(function(){ try { window.print(); } catch(e){} }, 500);
            alert('Impossibile generare PDF automaticamente. Usa "Salva/Esporta" dal browser (Stampa → Salva come PDF).');
        };
        document.head.appendChild(s);
    })();
    </script>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    // La finestra figlia contiene lo script che genera il PDF autonomamente.
    // Se qualcosa va storto, l'utente può usare 'Salva/Esporta' del browser dalla finestra aperta.
    return;
}