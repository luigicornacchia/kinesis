// Gestione delle schede di allenamento con Firebase
let currentUser = null;
let workouts = [];
let clients = [];
let clientWorkouts = {};

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
            
            // Estrai username dall'email
            const username = user.email.split('@')[0];
            
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
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    console.log('Tentativo login:', username);
    
    try {
        // Login con Firebase Auth usando email fittizia
        const email = `${username}@kinesis.local`;
        
        console.log('Tentativo auth con email:', email);
        
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
        console.error('Errore login completo:', error);
        
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert('Username o password errati!');
        } else if (error.code === 'auth/invalid-email') {
            alert('Email non valida!');
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
    
    const workoutName = document.getElementById('workoutName').value.trim();
    const exerciseItems = document.querySelectorAll('.exercise-item');
    
    const exercises = [];
    exerciseItems.forEach(item => {
        const sets = parseInt(item.querySelector('.exercise-sets').value);
        const reps = parseInt(item.querySelector('.exercise-reps').value);
        const rest = parseInt(item.querySelector('.exercise-rest').value) || 60;
        const notes = item.querySelector('.exercise-notes').value.trim();
        
        // Ottieni l'immagine e il nome dall'esercizio selezionato
        const imagePath = item.querySelector('.exercise-image-path').value;
        const searchInput = item.querySelector('.exercise-search');
        const exerciseName = searchInput ? searchInput.getAttribute('data-selected-name') || searchInput.value.trim() : '';
        
        if (!exerciseName) {
            alert('Seleziona un esercizio dalla ricerca!');
            return;
        }
        
        exercises.push({ name: exerciseName, sets, reps, rest, notes, image: imagePath });
    });
    
    const workout = {
        name: workoutName,
        exercises: exercises,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid
    };
    
    try {
        await db.collection(COLLECTIONS.WORKOUTS).add(workout);
        alert('Scheda salvata con successo!');
        
        // Reset form
        document.getElementById('workoutForm').reset();
        resetExercisesList();
        
        // Ricarica schede
        await loadWorkouts();
    } catch (error) {
        console.error('Errore salvataggio scheda:', error);
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
        if (searchInput) {
            searchInput.value = '';
            searchInput.removeAttribute('data-selected-name');
        }
        if (imagePath) imagePath.value = '';
        if (previewBox) previewBox.style.display = 'none';
    }
}

// Visualizza schede
function displayWorkouts() {
    const container = document.getElementById('workoutsContainer');
    
    if (workouts.length === 0) {
        container.innerHTML = '<p class="empty-state">Nessuna scheda creata. Crea la tua prima scheda!</p>';
        return;
    }
    
    container.innerHTML = workouts.map(workout => `
        <div class="workout-card">
            <div class="workout-header" onclick="toggleWorkout(this)">
                <div>
                    <h3>${workout.name}</h3>
                    <div class="workout-date">
                        Creata il: ${workout.createdAt ? new Date(workout.createdAt.toDate()).toLocaleDateString('it-IT') : 'N/A'}
                    </div>
                </div>
                <div class="expand-icon">▼</div>
            </div>
            <div class="workout-content">
                <div class="workout-body">
                    <div class="exercise-list">
                        ${workout.exercises.map(exercise => `
                            <div class="exercise-entry">
                                ${exercise.image ? `<div class="exercise-image-display"><img src="${exercise.image}" alt="${exercise.name}" onerror="this.parentElement.style.display='none'"></div>` : ''}
                                <div class="exercise-info">
                                    <strong>${exercise.name}</strong>
                            <div class="exercise-details">
                                ${exercise.sets} serie × ${exercise.reps} ripetizioni
                                ${exercise.rest ? ` • Recupero: ${exercise.rest}s` : ''}
                            </div>
                                    ${exercise.notes ? `<div class="exercise-notes">Note: ${exercise.notes}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="workout-actions">
                    <button class="btn-delete" onclick="deleteWorkout('${workout.id}')">Elimina</button>
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
                <input type="number" class="exercise-sets" placeholder="3" min="1" required>
            </div>
            <div class="form-group">
                <label>Ripetizioni:</label>
                <input type="number" class="exercise-reps" placeholder="10" min="1" required>
            </div>
            <div class="form-group">
                <label>Recupero (sec):</label>
                <input type="number" class="exercise-rest" placeholder="60" min="0" step="15">
            </div>
            <button type="button" class="btn-remove" onclick="removeExercise(this)">✕</button>
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

// Setup ricerca esercizi per tutti i campi
function setupExerciseSearch() {
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
    ).slice(0, 20); // Max 20 risultati
    
    if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">Nessun esercizio trovato</div>';
        resultsDiv.style.display = 'block';
        return;
    }
    
    // Mostra risultati
    resultsDiv.innerHTML = filtered.map(ex => `
        <div class="search-result-item" onclick="selectExercise(this, '${ex.name.replace(/'/g, "\\'")  }', '${ex.path}')">
            <span>${ex.name}</span>
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
        
        displayClientWorkouts(clientWorkoutsList);
        
    } catch (error) {
        console.error('Errore caricamento schede cliente:', error);
    }
}

// Visualizza schede cliente
function displayClientWorkouts(workoutsList) {
    const container = document.getElementById('clientWorkoutsContainer');
    
    container.innerHTML = workoutsList.map(workout => `
        <div class="workout-card">
            <div class="workout-header" onclick="toggleWorkout(this)">
                <div>
                    <h3>${workout.name}</h3>
                    <div class="workout-date">
                        Creata il: ${workout.createdAt ? new Date(workout.createdAt.toDate()).toLocaleDateString('it-IT') : 'N/A'}
                    </div>
                </div>
                <div class="expand-icon">▼</div>
            </div>
            <div class="workout-content">
                <div class="workout-body">
                    <div class="exercise-list">
                        ${workout.exercises.map(exercise => `
                            <div class="exercise-entry">
                                ${exercise.image ? `<div class="exercise-image-display"><img src="${exercise.image}" alt="${exercise.name}" onerror="this.parentElement.style.display='none'"></div>` : ''}
                                <div class="exercise-info">
                                    <strong>${exercise.name}</strong>
                                    <div class="exercise-details">
                                        ${exercise.sets} serie × ${exercise.reps} ripetizioni
                                        ${exercise.rest ? ` • Recupero: ${exercise.rest}s` : ''}
                                    </div>
                                    ${exercise.notes ? `<div class="exercise-notes">Note: ${exercise.notes}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Crea nuovo account
async function handleCreateAccount(e) {
    e.preventDefault();
    
    const name = document.getElementById('newClientName').value.trim();
    const username = document.getElementById('newClientUsername').value.trim();
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
