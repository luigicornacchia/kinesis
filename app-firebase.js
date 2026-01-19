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
});

// Controlla stato autenticazione
function checkAuthState() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Carica dati utente da Firestore
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
            if (userDoc.exists) {
                currentUser = { uid: user.uid, ...userDoc.data() };
                showDashboard(currentUser.role);
            }
        } else {
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
        const name = item.querySelector('.exercise-name').value.trim();
        const sets = parseInt(item.querySelector('.exercise-sets').value);
        const reps = parseInt(item.querySelector('.exercise-reps').value);
        const weight = parseFloat(item.querySelector('.exercise-weight').value) || 0;
        const notes = item.querySelector('.exercise-notes').value.trim();
        
        const imgPreview = item.querySelector('.image-preview img');
        const image = imgPreview && imgPreview.src && imgPreview.src.startsWith('data:') ? imgPreview.src : null;
        
        exercises.push({ name, sets, reps, weight, notes, image });
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
        const preview = firstExercise.querySelector('.image-preview');
        const img = preview.querySelector('img');
        const fileInput = firstExercise.querySelector('.exercise-image');
        img.src = '';
        preview.style.display = 'none';
        fileInput.style.display = 'block';
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
            <h3>${workout.name}</h3>
            <p style="color: #888; font-size: 0.9rem; margin-bottom: 10px;">
                Creata il: ${workout.createdAt ? new Date(workout.createdAt.toDate()).toLocaleDateString('it-IT') : 'N/A'}
            </p>
            <div class="exercise-list">
                ${workout.exercises.map(exercise => `
                    <div class="exercise-entry">
                        ${exercise.image ? `<div class="exercise-image-display"><img src="${exercise.image}" alt="${exercise.name}"></div>` : ''}
                        <div class="exercise-info">
                            <strong>${exercise.name}</strong>
                            <div class="exercise-details">
                                ${exercise.sets} serie × ${exercise.reps} ripetizioni
                                ${exercise.weight > 0 ? ` • ${exercise.weight} kg` : ''}
                            </div>
                            ${exercise.notes ? `<div class="exercise-notes">Note: ${exercise.notes}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="workout-actions">
                <button class="btn-delete" onclick="deleteWorkout('${workout.id}')">Elimina</button>
            </div>
        </div>
    `).join('');
}

// Elimina scheda
async function deleteWorkout(id) {
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
        <div class="form-row">
            <div class="form-group">
                <label>Nome Esercizio:</label>
                <input type="text" class="exercise-name" placeholder="es. Panca piana" required>
            </div>
            <div class="form-group">
                <label>Serie:</label>
                <input type="number" class="exercise-sets" placeholder="3" min="1" required>
            </div>
            <div class="form-group">
                <label>Ripetizioni:</label>
                <input type="number" class="exercise-reps" placeholder="10" min="1" required>
            </div>
            <div class="form-group">
                <label>Peso (kg):</label>
                <input type="number" class="exercise-weight" placeholder="50" min="0" step="0.5">
            </div>
            <button type="button" class="btn-remove" onclick="removeExercise(this)">✕</button>
        </div>
        <div class="form-group">
            <label>Note:</label>
            <input type="text" class="exercise-notes" placeholder="Note aggiuntive (opzionale)">
        </div>
        <div class="form-group image-upload-group">
            <label>Immagine Esercizio:</label>
            <div class="image-upload-container">
                <input type="file" class="exercise-image" accept="image/*" onchange="previewImage(this)">
                <div class="image-preview" style="display: none;">
                    <img src="" alt="Anteprima">
                    <button type="button" class="btn-remove-image" onclick="removeImage(this)">✕ Rimuovi</button>
                </div>
            </div>
        </div>
    `;
    exercisesList.appendChild(exerciseItem);
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

// Anteprima immagine
function previewImage(input) {
    const exerciseItem = input.closest('.exercise-item');
    const preview = exerciseItem.querySelector('.image-preview');
    const img = preview.querySelector('img');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            preview.style.display = 'block';
            input.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Rimuovi immagine
function removeImage(button) {
    const exerciseItem = button.closest('.exercise-item');
    const preview = exerciseItem.querySelector('.image-preview');
    const img = preview.querySelector('img');
    const fileInput = exerciseItem.querySelector('.exercise-image');
    
    img.src = '';
    fileInput.value = '';
    preview.style.display = 'none';
    fileInput.style.display = 'block';
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
            option.value = client.uid;
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
    
    const clientId = document.getElementById('clientSelect').value;
    const workoutId = document.getElementById('workoutSelect').value;
    
    if (!clientId || !workoutId) {
        alert('Seleziona sia il cliente che la scheda!');
        return;
    }
    
    try {
        // Verifica se già assegnata
        const existingAssignment = await db.collection(COLLECTIONS.CLIENT_WORKOUTS)
            .where('clientId', '==', clientId)
            .where('workoutId', '==', workoutId)
            .get();
        
        if (!existingAssignment.empty) {
            alert('Questo cliente ha già ricevuto questa scheda!');
            return;
        }
        
        // Crea assegnazione
        await db.collection(COLLECTIONS.CLIENT_WORKOUTS).add({
            clientId: clientId,
            workoutId: workoutId,
            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const client = clients.find(c => c.uid === clientId);
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
        // Ottieni assegnazioni per questo cliente
        const assignmentsSnapshot = await db.collection(COLLECTIONS.CLIENT_WORKOUTS)
            .where('clientId', '==', currentUser.uid)
            .get();
        
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
            <h3>${workout.name}</h3>
            <p style="color: #888; font-size: 0.9rem; margin-bottom: 10px;">
                Creata il: ${workout.createdAt ? new Date(workout.createdAt.toDate()).toLocaleDateString('it-IT') : 'N/A'}
            </p>
            <div class="exercise-list">
                ${workout.exercises.map(exercise => `
                    <div class="exercise-entry">
                        ${exercise.image ? `<div class="exercise-image-display"><img src="${exercise.image}" alt="${exercise.name}"></div>` : ''}
                        <div class="exercise-info">
                            <strong>${exercise.name}</strong>
                            <div class="exercise-details">
                                ${exercise.sets} serie × ${exercise.reps} ripetizioni
                                ${exercise.weight > 0 ? ` • ${exercise.weight} kg` : ''}
                            </div>
                            ${exercise.notes ? `<div class="exercise-notes">Note: ${exercise.notes}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
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
        
        // Crea utente in Firebase Auth
        const email = `${username}@kinesis.local`;
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Salva dati utente in Firestore
        await db.collection(COLLECTIONS.USERS).doc(userCredential.user.uid).set({
            username: username,
            password: password, // In produzione: NON salvare password in chiaro!
            name: name,
            role: 'client',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert(`Account creato con successo!\nNome: ${name}\nUsername: ${username}`);
        document.getElementById('createAccountForm').reset();
        
        // Logout dell'utente appena creato per tornare all'admin
        await auth.signOut();
        await auth.signInWithEmailAndPassword(`${currentUser.username}@kinesis.local`, currentUser.password);
        
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
        
        if (!confirm(`Sei sicuro di voler eliminare l'account di ${user.name}?\nQuesta azione eliminerà anche tutte le schede associate.`)) {
            return;
        }
        
        // Elimina utente da Firestore
        await db.collection(COLLECTIONS.USERS).doc(userId).delete();
        
        // Elimina assegnazioni schede
        const assignments = await db.collection(COLLECTIONS.CLIENT_WORKOUTS)
            .where('clientId', '==', userId)
            .get();
        
        const deletePromises = assignments.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        
        alert('Account eliminato con successo.');
        displayAccountsList();
        populateClientSelect();
        
    } catch (error) {
        console.error('Errore eliminazione account:', error);
        alert('Errore durante l\'eliminazione');
    }
}
