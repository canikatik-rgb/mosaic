const CLIENT_ID = '651237871797-jcvgcij7rlmhpfafgrr6vc9a2p5ghfes.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // Keep Drive scope for future

let tokenClient;
let gapiInited = false;
let gisInited = false;
let googleAccessToken = null;
let isCreatingForDrive = false; // Flag to indicate if the current creation process is for Drive

/**
 * Minimal GAPI client init (just loads library)
 */
function gapiInit() {
    gapi.load('client', () => {
        gapi.client.init({}) // Initialize base client
            .then(() => {
                // Load Drive API
                return gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
            })
            .then(() => {
                gapiInited = true;
                console.log("GAPI client and Drive API loaded.");
                maybeEnableAuthControls();
                // trySilentSignIn(); // Keep disabled for now
                // --- MODIFICATION: Attempt silent sign-in --- 
                attemptSilentSignIn();
                // --- END MODIFICATION ---
            })
            .catch(error => {
                console.error("Error initializing GAPI client:", error);
                maybeEnableAuthControls();
            });
    });
}

/**
 * Minimal GIS init (gets token, shows alert)
 */
function gisInit() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => { // Make callback async again
            if (tokenResponse && tokenResponse.access_token) {
                googleAccessToken = tokenResponse.access_token;
                window.googleAccessToken = googleAccessToken; // <<< MODIFICATION: Attach to window
                console.log("Access Token received:", googleAccessToken);

                // Update UI to show signed-in state (will hide sign-in button etc.)
                updateSignInStatus(true);

                try {
                    console.log("Attempting to list Drive files after sign-in...");
                    const files = await listDriveFiles();

                    // *** Add diagnostic logs before calling showDriveDashboard ***
                    const welcomeModalCheck = document.getElementById('welcome-modal');
                    const dashboardCheck = document.getElementById('drive-dashboard');
                    console.log('[gisInit] Before showDriveDashboard call: Welcome modal active?', welcomeModalCheck?.classList.contains('active'));
                    console.log('[gisInit] Before showDriveDashboard call: Dashboard element exists?', !!dashboardCheck);
                    console.log('[gisInit] Before showDriveDashboard call: Dashboard display style?', dashboardCheck?.style.display);
                    // ***************************************************************

                    showDriveDashboard(files); // Call after files are listed
                    enableDriveSync();
                } catch (error) {
                    console.error("Error listing/showing Drive files after sign-in:", error);
                    alert(`Could not load projects: ${error.message || 'Unknown error'}`);
                    // If listing fails, revert to signed-out state UI within the modal
                    updateSignInStatus(false);
                    const welcomeModal = document.getElementById('welcome-modal');
                    if (welcomeModal && !welcomeModal.classList.contains('active')) showModal(welcomeModal);
                }

            } else {
                console.error("Token response error or missing access_token:", tokenResponse);
                alert("Giriş sırasında beklenmedik bir hata oluştu (token data invalid).");
                updateSignInStatus(false);
            }
        },
        error_callback: (error) => { // Error callback (remains the same)
            console.error("Token client error:", error);
            const isSilentFailure = error.type !== 'user_cancel' && error.type !== 'popup_closed_by_user';
            const criticalError = error.type === 'invalid_request' || error.type === 'unauthorized_client' || error.type === 'access_denied' || error.type === 'invalid_scope' || error.type === 'server_error';
            if (!isSilentFailure || criticalError) {
                alert(`Giriş başarısız oldu: ${error.type}`);
            } else {
                console.log(`Silent sign-in failed or token refresh needed (${error.type}). User needs to sign in manually.`);
            }
            updateSignInStatus(false);
        }
    });
    gisInited = true;
    console.log("GIS token client initialized.");
    maybeEnableAuthControls();
}

/**
 * Enables auth button when both libs are ready
 */
function maybeEnableAuthButton() {
    const signInButton = document.getElementById('google-signin-btn');
    if (gapiInited && gisInited && signInButton) {
        signInButton.disabled = false;
        signInButton.style.display = 'flex'; // Ensure it's visible
        console.log("Minimal Auth button enabled.");
    } else if (signInButton) {
        signInButton.disabled = true;
    }
}

/**
 * Handles auth button click (simple consent request)
 */
function handleAuthClick() {
    if (!tokenClient) {
        console.error("Minimal handleAuthClick: Token client not initialized.");
        alert("Giriş sistemi henüz hazır değil (Minimal).");
        return;
    }
    console.log("Minimal handleAuthClick: Requesting token with consent.");
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * Global callback for Google library load
 */
window.onGoogleLibraryLoad = () => {
    console.log("Minimal onGoogleLibraryLoad: Initializing GIS and GAPI...");
    gisInit();
    // Ensure GAPI is loaded - check existence before calling load
    if (typeof gapi !== 'undefined' && gapi.load) {
        gapiInit();
    } else {
        console.error("Minimal onGoogleLibraryLoad: GAPI library not found!");
        // Attempt to load GAPI dynamically as a fallback
        loadGapiScriptFallback();
    }
};

// Fallback GAPI loader
function loadGapiScriptFallback() {
    console.log("Attempting to load GAPI script dynamically...");
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
        console.log("GAPI script loaded dynamically.");
        gapiInit(); // Initialize GAPI after dynamic load
    };
    script.onerror = () => {
        console.error("Failed to load GAPI script dynamically.");
        // Still try to enable button if GIS is ready? Maybe not safe.
        maybeEnableAuthButton();
    };
    document.body.appendChild(script);
}

// Expose handleAuthClick globally
window.handleAuthClick = handleAuthClick;

// Placeholder/Helper for the function called in minimal gisInit callback
function initializeAppUIIfNeeded() {
    const appContainer = document.getElementById('app-container');
    if (appContainer && appContainer.style.display === 'none') {
        console.log("(Minimal Flow) Initializing main app UI...");
        const video = document.getElementById('background-video');
        // --- MODIFICATION: Store video HTML before removing --- 
        if (video) {
            window.originalVideoHTML = video.outerHTML; // Store original HTML
        }
        // --- END MODIFICATION ---
        document.body.classList.add('app-active');
        if (window.initializeAppUI) {
            window.initializeAppUI(); // Call the function from main.js
        } else {
            console.error("(Minimal Flow) initializeAppUI function not found on window!");
        }
        // --- MODIFICATION: Use timeout to remove video --- 
        setTimeout(() => {
            if (video) {
                console.log("(Minimal Flow) Removing background video.");
                video.remove();
            }
        }, 600); // Delay removal
        // --- END MODIFICATION ---
    } else {
        console.log("(Minimal Flow) Main app UI already initialized or not needed.");
        // If already initialized, ensure video is removed if it still exists somehow
        const lingeringVideo = document.getElementById('background-video');
        if (lingeringVideo) {
            console.warn("(Minimal Flow) Removing lingering background video.");
            lingeringVideo.remove();
        }
    }
}

/**
 * Updates UI elements based on sign-in status.
 */
function updateSignInStatus(isSignedIn) {
    const googleSignInButton = document.getElementById('google-signin-btn');
    const driveDashboard = document.getElementById('drive-dashboard');
    console.log('[updateSignInStatus] Found #drive-dashboard on entry?', !!driveDashboard);
    const welcomeOptions = document.querySelector('#welcome-modal .welcome-options');
    const driveNewProjectBtn = document.getElementById('drive-new-project-btn');
    const signOutBtn = document.getElementById('sign-out-btn');

    if (isSignedIn) {
        if (welcomeOptions) welcomeOptions.style.display = 'none';
        if (driveDashboard) {
            driveDashboard.style.display = 'block';
            console.log('[updateSignInStatus] Set #drive-dashboard display to block. Current display:', driveDashboard.style.display);
        }
    } else {
        if (welcomeOptions) welcomeOptions.style.display = 'flex';
        if (driveDashboard) driveDashboard.style.display = 'none';
        googleAccessToken = null;
        window.googleAccessToken = null; // <<< MODIFICATION: Clear from window
        if (window.disableDriveSync) disableDriveSync();
        updateDriveStatusIndicator('error'); // Show error when signed out
    }
    if (window.maybeEnableAuthControls) maybeEnableAuthControls();
    console.log('[updateSignInStatus] Finished. (Control/Sync calls enabled)');
}

/**
 * Fetches files from Google Drive.
 */
async function listDriveFiles() {
    if (!googleAccessToken || !gapiInited || !gapi.client.drive) {
        throw new Error("Google Drive API not ready or not signed in.");
    }
    console.log("Listing Drive files...");
    const loadingIndicator = document.querySelector('#drive-file-list .drive-loading');
    if (loadingIndicator) loadingIndicator.style.display = 'block'; // Show loading
    // Use translation for loading text
    if (loadingIndicator) loadingIndicator.textContent = getText('driveLoading') || 'Loading projects...';

    try {
        const response = await gapi.client.drive.files.list({
            'spaces': 'drive',
            'q': "mimeType='application/json' and name contains '.mosaic' and trashed = false",
            'fields': 'files(id, name, modifiedTime, iconLink)',
            'orderBy': 'modifiedTime desc'
        });
        console.log("Drive files response:", response);
        // Hide loading indicator before processing
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        const files = response.result.files || [];

        return files; // Still return files if needed elsewhere (gisInit doesn't need it now)
    } catch (error) {
        console.error("Error listing Drive files:", error);
        if (loadingIndicator) {
            // Show translated error message
            loadingIndicator.textContent = getText('driveSyncError') || 'Error loading files.';
            loadingIndicator.style.display = 'block'; // Keep visible on error
        }
        if (error.status === 401) {
            googleAccessToken = null; updateSignInStatus(false);
            throw new Error("Authorization expired. Please sign in again.");
        }
        throw error; // Re-throw other errors
    }
}

/**
 * Displays the Google Drive project dashboard in the Welcome Modal.
 */
function showDriveDashboard(files = []) {
    console.log('[showDriveDashboard] Function called.');
    // Use setTimeout to ensure DOM elements are ready
    setTimeout(() => {
        console.log('[showDriveDashboard] Running inside setTimeout.');
        const dashboardDiv = document.getElementById('drive-dashboard');
        console.log('[showDriveDashboard] Found #drive-dashboard in setTimeout?', !!dashboardDiv);
        const fileListDiv = document.getElementById('drive-file-list');
        const welcomeModalContent = document.querySelector('#welcome-modal .modal-content');
        const driveNewProjectBtn = document.getElementById('drive-new-project-btn');
        const signOutBtn = document.getElementById('sign-out-btn');
        const driveTitle = dashboardDiv?.querySelector('.drive-title');
        const driveUploadBtn = document.getElementById('drive-upload-btn');
        const driveUploadInput = document.getElementById('drive-upload-input');

        if (!dashboardDiv || !fileListDiv || !welcomeModalContent || !driveNewProjectBtn || !signOutBtn || !driveTitle || !driveUploadBtn || !driveUploadInput) {
            console.error("Dashboard elements (including upload) still not found inside setTimeout in showDriveDashboard.");
            // Attempt to diagnose further
            console.log("dashboardDiv:", !!dashboardDiv);
            console.log("fileListDiv:", !!fileListDiv);
            console.log("welcomeModalContent:", !!welcomeModalContent);
            console.log("driveNewProjectBtn:", !!driveNewProjectBtn);
            console.log("signOutBtn:", !!signOutBtn);
            console.log("driveTitle:", !!driveTitle);
            console.log("driveUploadBtn:", !!driveUploadBtn);
            console.log("driveUploadInput:", !!driveUploadInput);
            return;
        }

        // --- MODIFICATION: Use translations ---
        driveTitle.textContent = getText('googleDriveTitle') || 'Google Drive Projects';
        driveNewProjectBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${getText('driveNewProject') || 'New Project'}`;
        signOutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> ${getText('driveSignOut') || 'Sign Out'}`;
        driveUploadBtn.innerHTML = `<i class="fas fa-upload"></i> ${getText('driveUploadProject') || 'Upload Project'}`;

        console.log("Rendering Drive dashboard with files:", files);
        fileListDiv.innerHTML = ''; // Clear previous list/loading message

        if (files.length === 0) {
            fileListDiv.innerHTML = `<p class="drive-empty">${getText('driveEmpty') || 'No Mosaic projects found in your Google Drive.'}</p>`;
        } else {
            files.forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'drive-file-item';
                fileItem.dataset.fileId = file.id;
                const iconSrc = file.iconLink || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-text" viewBox="0 0 16 16"><path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 12a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1z"/><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2M9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/></svg>';
                fileItem.innerHTML = `
                <img src="${iconSrc}" alt="File icon" class="drive-file-icon">
                <span class="drive-file-name">${file.name.replace('.mosaic', '')}</span>
                <span class="drive-file-modified">${new Date(file.modifiedTime).toLocaleDateString()}</span>
            `;
                fileItem.addEventListener('click', () => {
                    console.log(`Dashboard: Opening project from Drive: ${file.id}`);
                    openProjectFromDrive(file.id);
                });
                fileListDiv.appendChild(fileItem);
            });
        }

        // Setup dashboard buttons
        console.log('[showDriveDashboard] Assigning button listeners inside setTimeout...');
        driveNewProjectBtn.onclick = () => {
            console.log('[showDriveDashboard] New Project button clicked.');
            console.log("Dashboard: New Project clicked. Setting flag and opening modal...");
            isCreatingForDrive = true;
            const welcomeModal = document.getElementById('welcome-modal');
            const newProjectModal = document.getElementById('new-project-modal');
            const projectNameInput = document.getElementById('project-name');
            if (welcomeModal && window.hideModal) hideModal(welcomeModal);
            if (newProjectModal && projectNameInput && window.showModal) {
                projectNameInput.value = '';
                showModal(newProjectModal);
                setTimeout(() => projectNameInput.focus(), 100);
            } else {
                console.error("'New Project' modal or input not found!");
                initializeAppUIIfNeeded();
                if (window.createNewProject) createNewProject();
            }
        };

        driveUploadBtn.onclick = () => {
            console.log('[showDriveDashboard] Upload Project button clicked.');
            // Dosya formatı kabul ifadesini genişlet
            driveUploadInput.accept = '.mosaic,application/json,text/plain,.json';
            driveUploadInput.click();
        };

        driveUploadInput.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            event.target.value = null;
            console.log(`[Drive Upload] Selected file:`, {
                name: file.name,
                type: file.type,
                size: file.size
            });

            // .mosaic uzantısı kontrolü
            if (!file.name.endsWith('.mosaic') && !file.name.endsWith('.json')) {
                alert('Please select a valid .mosaic or .json file.');
                return;
            }

            console.log(`[Drive Upload] Attempting to upload file: ${file.name}`);
            updateDriveStatusIndicator('saving');
            driveUploadBtn.disabled = true;

            try {
                // Dosya içeriğini oku
                const fileContent = await file.text();
                console.log(`[Drive Upload] File content read, length: ${fileContent.length} bytes`);

                // JSON ayrıştırma ve doğrulama
                let projectData;
                try {
                    projectData = JSON.parse(fileContent);

                    // Temel doğrulama: Object olmalı
                    if (!projectData || typeof projectData !== 'object') {
                        throw new SyntaxError("Invalid project structure: Not an object");
                    }

                    console.log("[Drive Upload] File content parsed as valid JSON");
                } catch (parseError) {
                    console.error("[Drive Upload] JSON Parse Error:", parseError);
                    throw new SyntaxError("Invalid file format. The file could not be parsed as valid JSON.");
                }

                // Dosya adını belirle
                const projectName = projectData.name || file.name.replace(/\.(mosaic|json)$/, '');
                const driveFileName = `${projectName}.mosaic`;

                console.log(`[Drive Upload] Using filename: ${driveFileName}, content length: ${fileContent.length}`);
                console.log("[Drive Upload] Project data:", {
                    name: projectData.name,
                    nodeCount: projectData.nodes?.length || 0,
                    connectionCount: projectData.connections?.length || 0
                });

                try {
                    // İlk adım: Metadata ile dosyayı oluştur
                    console.log("[Drive Upload] Step 1: Creating file with metadata");

                    // Yükleme göstergesini ekle
                    showLoadingOverlay(getText('uploadingToDrive') || 'Uploading to Drive...');

                    const metadataResponse = await gapi.client.request({
                        path: '/drive/v3/files',
                        method: 'POST',
                        body: JSON.stringify({
                            name: driveFileName,
                            mimeType: 'application/json',
                            parents: ['root']
                        })
                    });

                    const newFile = metadataResponse.result;
                    console.log("[Drive Upload] Step 1 complete, file created with ID:", newFile.id);

                    // İkinci adım: İçeriği yükle
                    console.log("[Drive Upload] Step 2: Uploading file content");
                    await gapi.client.request({
                        path: `/upload/drive/v3/files/${newFile.id}`,
                        method: 'PATCH',
                        params: { uploadType: 'media' },
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: fileContent
                    });

                    console.log("[Drive Upload] Step 2 complete, content uploaded");

                    // Son adım: Dosya bilgilerini al
                    const fileInfoResponse = await gapi.client.drive.files.get({
                        fileId: newFile.id,
                        fields: 'id,name,mimeType,size,webViewLink'
                    });

                    const uploadedFile = fileInfoResponse.result;
                    console.log("[Drive Upload] Final file info:", uploadedFile);

                    // Başarı mesajını kaldır (alert yerine konsola yaz)
                    console.log(`Project '${projectName}' uploaded successfully to Google Drive!`);

                    // Drive dosya listesini güncelle
                    listDriveFiles();
                    updateDriveStatusIndicator('synced');

                    // Dosyayı otomatik olarak aç
                    console.log(`[Drive Upload] Auto-opening uploaded file ID: ${uploadedFile.id}`);
                    setTimeout(() => {
                        openProjectFromDrive(uploadedFile.id);
                    }, 500);

                } catch (apiError) {
                    console.error("[Drive Upload] API Error:", apiError);
                    hideLoadingOverlay(); // Hata durumunda yükleme göstergesini kaldır
                    throw apiError;
                }
            } catch (error) {
                console.error("Error uploading project to Google Drive:", error);
                hideLoadingOverlay(); // Ana hata durumunda da yükleme göstergesini kaldır
                updateDriveStatusIndicator('error');
                let errorMessage = 'Unknown error during upload';
                if (error instanceof SyntaxError) {
                    errorMessage = 'Invalid file format. Could not parse JSON.';
                } else if (error.result && error.result.error) {
                    errorMessage = `${error.result.error.message} (Code: ${error.result.error.code})`;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                alert(`Failed to upload project: ${errorMessage}`);
                // Handle potential authorization error
                const status = error.status || error.result?.error?.code;
                if (status === 401) {
                    googleAccessToken = null;
                    updateSignInStatus(false);
                    alert("Authorization expired or invalid. Please sign in again.");
                }
            } finally {
                driveUploadBtn.disabled = false; // Re-enable button
                // Optionally reset status indicator after a short delay if needed
                // setTimeout(() => updateDriveStatusIndicator( googleAccessToken ? 'synced' : 'offline'), 2000);
            }
        };

        signOutBtn.onclick = () => {
            console.log('[showDriveDashboard] Sign Out button clicked.'); // Log inside handler
            handleSignOutClick(); // Call the actual sign out function
        };
        console.log('[showDriveDashboard] Button listeners assigned.'); // Log after assignment

        // Ensure dashboard is visible (updateSignInStatus should have done this, but double check)
        dashboardDiv.style.display = 'block';

        // Adjust modal height for content
        welcomeModalContent.style.maxHeight = '80vh';
        welcomeModalContent.style.overflowY = 'auto';
    }, 0); // Set timeout delay to 0
}

/**
 * Opens a project file from Google Drive.
 */
async function openProjectFromDrive(fileId) {
    if (!googleAccessToken || !gapiInited || !gapi.client.drive) {
        alert("Google Drive is not ready or you are not signed in.");
        if (window.hideLoadingOverlay) window.hideLoadingOverlay(); // Yükleme göstergesini kaldır
        return;
    }

    console.log(`[openProjectFromDrive] Fetching content for Drive file ID: ${fileId}`);

    const dashboardDiv = document.getElementById('drive-dashboard');
    if (dashboardDiv) dashboardDiv.classList.add('loading');

    try {
        // İlk olarak dosya hakkında temel bilgileri al
        const fileInfoResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'name,mimeType,size'
        });

        const fileInfo = fileInfoResponse.result;
        console.log(`[openProjectFromDrive] Retrieved file info:`, fileInfo);

        // İçerik almadan önce hata mesajını güncelleyelim
        let errorHandler = (error) => {
            console.error(`[openProjectFromDrive] Error loading file:`, error);
            alert(`Could not open project from Google Drive (File ID: ${fileId}). ${error.message || ''}`);
            if (dashboardDiv) dashboardDiv.classList.remove('loading');
        };

        // İçeriği almak için direkt API isteği kullanma
        try {
            console.log(`[openProjectFromDrive] Fetching file content directly via API...`);
            const mediaResponse = await gapi.client.request({
                path: `/drive/v3/files/${fileId}`,
                method: 'GET',
                params: {
                    alt: 'media'
                },
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!mediaResponse.body) {
                throw new Error("Received empty response from Drive API");
            }

            console.log(`[openProjectFromDrive] Content received, length: ${mediaResponse.body.length} bytes`);

            // JSON içeriğini ayrıştır
            let projectData;
            try {
                projectData = JSON.parse(mediaResponse.body);

                // Gerekli özelliklerin varlığını doğrula
                if (!projectData || typeof projectData !== 'object') {
                    throw new SyntaxError("Invalid project structure");
                }

                console.log(`[openProjectFromDrive] Project data loaded:`, {
                    name: projectData.name,
                    nodes: (projectData.nodes || []).length,
                    connections: (projectData.connections || []).length
                });
            } catch (parseError) {
                console.error(`[openProjectFromDrive] JSON parse error:`, parseError);
                throw new Error(`Could not parse project data: ${parseError.message}`);
            }

            // Mevcut projeyi kaydet (eğer varsa)
            const appContainer = document.getElementById('app-container');
            if (activeProjectIndex >= 0 && appContainer && appContainer.style.display !== 'none' && window.saveProjectState) {
                saveProjectState(activeProjectIndex);
            }

            // Yeni projeyi oluştur
            const project = new Project(
                projectData.name || fileInfo.name.replace(/\.mosaic$/, '') || 'Untitled from Drive',
                projectData.nodes || [],
                projectData.connections || []
            );

            // Drive kimliğini ve diğer özellikleri ayarla
            project.driveFileId = fileId;
            project.canvasOffset = projectData.canvasOffset || { x: 0, y: 0 };
            project.canvasScale = projectData.canvasScale || 1;

            // Welcome modalı kapat
            const welcomeModal = document.getElementById('welcome-modal');
            if (welcomeModal && window.hideModal) hideModal(welcomeModal);

            // Uygulama arayüzünü başlat
            initializeAppUIIfNeeded();

            // Projeyi diziye ekle
            if (!window.projects || !Array.isArray(window.projects)) {
                console.error("Global projects array not found or not an array.");
                alert("Internal error: Cannot manage projects.");
                return;
            }

            window.projects.push(project);
            const newIndex = window.projects.length - 1;

            // Projeye geç ve UI'ı güncelle
            if (window.switchToProject) {
                switchToProject(newIndex);
            } else {
                console.error("switchToProject function not found globally.");
                alert("Error loading project into the application.");
                return;
            }

            console.log(`Project '${project.name}' (Drive ID: ${fileId}) opened successfully`);

            // Canvas görünümünü sıfırla
            if (window.resetCanvasView) {
                setTimeout(() => window.resetCanvasView(), 100);
            }

            // Drive durumunu güncelle
            if (window.createDriveStatusIndicator) {
                window.createDriveStatusIndicator();
            }

        } catch (mediaError) {
            console.error(`[openProjectFromDrive] Error fetching file content:`, mediaError);
            throw mediaError;
        }

    } catch (error) {
        console.error(`Error opening project from Drive (ID: ${fileId}):`, error);
        alert(`Could not open the project from Google Drive. ${error.message || ''}`);
        if (error.status === 401) {
            googleAccessToken = null;
            updateSignInStatus(false);
            alert("Authorization expired. Please sign in again.");
            if (window.showModal) showModal(document.getElementById('welcome-modal'));
        }
    } finally {
        if (dashboardDiv) dashboardDiv.classList.remove('loading');
        if (window.hideLoadingOverlay) window.hideLoadingOverlay(); // Yükleme göstergesini kaldır
    }
}

/**
 * Handles the sign-out process.
 */
function handleSignOutClick() {
    if (googleAccessToken) {
        google.accounts.oauth2.revoke(googleAccessToken, () => {
            console.log('Access token revoked.');
            googleAccessToken = null;
            updateSignInStatus(false); // This will hide dashboard, show original options

            // Show welcome modal again, ensuring it's reset
            const welcomeModal = document.getElementById('welcome-modal');
            if (welcomeModal && window.showModal) {
                const welcomeModalContent = document.querySelector('#welcome-modal .modal-content');
                if (welcomeModalContent) { // Reset height/scroll
                    welcomeModalContent.style.maxHeight = '';
                    welcomeModalContent.style.overflowY = '';
                }
                showModal(welcomeModal);
            }
        });
    }
}

function maybeEnableAuthControls() {
    console.log('[maybeEnableAuthControls] Running...'); // Log entry
    const signInButton = document.getElementById('google-signin-btn');
    const driveNewProjectBtn = document.getElementById('drive-new-project-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const driveUploadBtn = document.getElementById('drive-upload-btn');
    const ready = gapiInited && gisInited;
    const isSignedIn = !!googleAccessToken;
    console.log(`[maybeEnableAuthControls] State: ready=${ready}, isSignedIn=${isSignedIn}`); // Log state

    if (signInButton) signInButton.disabled = !ready;

    // Default to disabled unless explicitly enabled
    if (driveNewProjectBtn) driveNewProjectBtn.disabled = true;
    if (signOutBtn) signOutBtn.disabled = true;
    if (driveUploadBtn) driveUploadBtn.disabled = true;

    if (ready) {
        if (isSignedIn) { // Signed In
            console.log('[maybeEnableAuthControls] Enabling Drive buttons.'); // Log enabling
            if (signInButton) signInButton.style.display = 'none';
            if (driveNewProjectBtn) driveNewProjectBtn.disabled = false;
            if (signOutBtn) signOutBtn.disabled = false;
            if (driveUploadBtn) driveUploadBtn.disabled = false;
        } else { // Signed Out
            console.log('[maybeEnableAuthControls] Disabling Drive buttons / Enabling Sign In.'); // Log disabling
            if (signInButton) signInButton.style.display = 'flex';
            // Buttons remain disabled from default state above
        }
    }
    console.log(`Auth controls updated: GAPI=${gapiInited}, GIS=${gisInited}, SignedIn=${isSignedIn}.`);
}

// --- Add back necessary functions from previous steps ---

// --- Add back Drive Sync Control placeholders ---
let isDriveSyncEnabled = false;
let driveDebounceTimeout;

function enableDriveSync() {
    // Placeholder - will be fully implemented later
    console.log("Drive Sync placeholder enabled.");
    isDriveSyncEnabled = true;
}

function disableDriveSync() {
    // Placeholder - will be fully implemented later
    console.log("Drive Sync placeholder disabled.");
    clearTimeout(driveDebounceTimeout);
    isDriveSyncEnabled = false;
}

// --- Auto Save Logic ---
let autoSaveTimeout = null;
const AUTO_SAVE_DELAY = 2500; // Delay in milliseconds (e.g., 2.5 seconds)

// Debounced function to call the actual save
const debouncedSaveToDrive = () => {
    clearTimeout(autoSaveTimeout); // Clear any existing timeout
    console.log("[debouncedSaveToDrive] Setting timeout."); // Log setting timeout
    autoSaveTimeout = setTimeout(async () => {
        console.log("[debouncedSaveToDrive] Running actual save logic."); // Log execution
        // Check token validity *before* attempting to save
        const isTokenValid = await checkTokenValidity();
        if (!isTokenValid) {
            console.log("Auto-save skipped: Token is invalid or user signed out.");
            // Status indicator is already updated by checkTokenValidity
            return; // Don't proceed with save
        }

        // Check if signed in and sync enabled before saving (redundant check, but safe)
        if (googleAccessToken && isDriveSyncEnabled && window.saveProjectToDrive) {
            console.log(`Auto-saving project to Drive after ${AUTO_SAVE_DELAY}ms delay...`);
            // Update status indicator to 'saving'
            updateDriveStatusIndicator('saving');
            try {
                await window.saveProjectToDrive();
                // Update status indicator to 'synced' on success
                updateDriveStatusIndicator('synced');
            } catch (error) {
                // Update status indicator to 'error' on failure
                updateDriveStatusIndicator('error');
                console.error("Auto-save to Drive failed:", error);
                // Error handling is done within saveProjectToDrive itself (e.g., alerts)
            }
        } else {
            console.log("Auto-save skipped: Not signed in or Drive sync disabled.");
            // Optionally update status to 'offline' or similar
            updateDriveStatusIndicator('offline');
        }
    }, AUTO_SAVE_DELAY);
};

// Function to call whenever a change occurs that should trigger an auto-save
function scheduleAutoSave() {
    // Only schedule if sync is enabled and user is logged in
    if (isDriveSyncEnabled && googleAccessToken) {
        console.log("[scheduleAutoSave] Triggered."); // Log trigger
        updateDriveStatusIndicator('pending');
        debouncedSaveToDrive();
    } else {
        // updateDriveStatusIndicator('offline'); // Show error instead
        updateDriveStatusIndicator('error');
    }
}
window.scheduleAutoSave = scheduleAutoSave; // Expose globally

// --- Replace the saveProjectToDrive placeholder with the full implementation ---
async function saveProjectToDrive() {
    const activeIndex = window.getActiveProjectIndex ? window.getActiveProjectIndex() : -1;

    if (activeIndex < 0 || !window.projects || activeIndex >= window.projects.length) {
        console.warn("saveProjectToDrive: No active project selected or projects array unavailable.");
        alert("No active project to save to Drive.");
        return;
    }

    if (!googleAccessToken || !gapiInited || !gapi.client.drive) {
        console.warn("saveProjectToDrive: Not signed in or Drive API not ready.");
        // Potentially fall back to local save or prompt user to sign in?
        // For now, show an alert.
        alert("Please sign in to Google to save the project to Drive.");
        return;
    }

    // --- CRITICAL FIX: Save current state from DOM to memory before saving to Drive ---
    // This ensures that recent changes (like content-only mode toggles) are captured
    if (typeof activeIndex !== 'undefined' && activeIndex >= 0) {
        console.log("[saveProjectToDrive] Capturing current project state from DOM...");
        window.saveProjectState(activeIndex); // Use window.saveProjectState as it's a global function
    }
    // ----------------------------------------------------------------------------------

    const project = window.projects[activeIndex];
    console.log(`Attempting to save project '${project.name}' (Drive ID: ${project.driveFileId || 'None'}) to Google Drive.`);

    // Ensure project state is up-to-date
    if (window.saveProjectState) {
        window.saveProjectState(activeIndex);
    } else {
        console.error("saveProjectState function not found! Cannot ensure data consistency.");
        alert("Internal error: Could not prepare project data for saving.");
        return;
    }

    // Show saving indicator (e.g., on the tab)
    const activeTab = document.querySelector(`.project-tab[data-project-index="${activeIndex}"]`);
    if (activeTab) {
        activeTab.classList.add('saving');
    }

    try {
        const fileName = `${project.name}.mosaic`;
        // Exclude transient or large unnecessary data before stringifying
        // Also remove driveFileId from the JSON content itself
        const projectDataToSave = {
            id: project.id,
            name: project.name,
            nodes: project.nodes,
            connections: project.connections,
            canvasOffset: project.canvasOffset,
            canvasScale: project.canvasScale,
            lastModified: Date.now()
        };
        const projectJson = JSON.stringify(projectDataToSave, null, 2);
        const media = {
            mimeType: 'application/json',
            body: projectJson
        };

        let driveFile;
        if (project.driveFileId) {
            // Update existing file using gapi.client.request (PATCH)
            console.log(`Updating existing Drive file ID: ${project.driveFileId} via gapi.client.request (PATCH) with data:`, projectJson);
            try {
                // Log before the update call
                console.log(`[saveProjectToDrive] Attempting gapi.client.request (PATCH) for ID: ${project.driveFileId}`);
                const updateResponse = await gapi.client.request({
                    path: `/upload/drive/v3/files/${project.driveFileId}`, // Use upload path
                    method: 'PATCH',
                    params: {
                        uploadType: 'media',
                        fields: 'id, name, modifiedTime' // Request updated metadata
                    },
                    // Add resource param to explicitly set metadata like name during PATCH
                    resource: {
                        name: fileName
                    },
                    headers: {
                        'Content-Type': 'application/json' // Body content type
                    },
                    body: projectJson // Send the raw JSON string as the request body
                });

                // Assuming the response structure is similar to create/update
                driveFile = updateResponse.result;
                console.log("File updated via gapi.client.request (PATCH):", driveFile);
                // Log the full response as well
                console.log("[saveProjectToDrive] Full gapi.client.request (PATCH) response:", updateResponse);
            } catch (updateError) {
                console.error("Error updating file via gapi.client.request (PATCH):", updateError);
                // Log full error details
                console.error("[saveProjectToDrive] gapi.client.request (PATCH) Error Details:", JSON.stringify(updateError, null, 2));
                // Rethrow the error to be caught by the outer try...catch
                return; // Don't rethrow, let the finally block execute
            }
        } else {
            // Create new file (This part uses gapi.client.request already)
            console.log(`Creating new file in Drive root for project: ${project.name} with data:`, projectJson);
            const metadata = {
                name: fileName,
                mimeType: 'application/json',
                // parents: ['appDataFolder'] // Use root instead
                parents: ['root']
            };
            const createResponse = await gapi.client.drive.files.create({
                resource: metadata,
                media: media,
                fields: 'id, name, modifiedTime, iconLink'
            });
            driveFile = createResponse.result;
            console.log("New file created on Drive:", driveFile);
            // IMPORTANT: Update the local project object with the new Drive ID
            project.driveFileId = driveFile.id;
            // Update the UI (e.g., tab) to reflect the saved state/ID
            if (window.updateProjectTabs) window.updateProjectTabs();
        }

        // Update last modified time locally (or use Drive's modifiedTime if needed)
        project.lastModified = driveFile.modifiedTime ? new Date(driveFile.modifiedTime).getTime() : Date.now();
        if (window.updateProjectTabs) window.updateProjectTabs(); // Update tab display

        console.log(`Project '${project.name}' saved successfully to Drive (ID: ${project.driveFileId}).`);
        // Optional: Add a success notification
        updateDriveStatusIndicator('synced'); // Ensure status is updated on successful save

    } catch (error) {
        console.error("Error saving project to Google Drive:", error);
        // Log detailed error object
        console.error("Drive Save Error Details:", JSON.stringify(error, null, 2));
        updateDriveStatusIndicator('error'); // Update status indicator on error
        // Try to parse Google API error response
        let errorMessage = 'Unknown error';
        if (error.result && error.result.error) {
            errorMessage = `${error.result.error.message} (Code: ${error.result.error.code})`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        alert(`Failed to save project to Google Drive: ${errorMessage}`);

        // Handle potential authorization error
        const status = error.status || error.result?.error?.code;
        if (status === 401) {
            googleAccessToken = null;
            updateSignInStatus(false);
            alert("Authorization expired or invalid. Please sign in again.");
            // Optionally, re-show the welcome modal or prompt for sign-in
            // if (window.showModal) showModal(document.getElementById('welcome-modal'));
        }
    } finally {
        // Remove saving indicator
        if (activeTab) {
            activeTab.classList.remove('saving');
        }
    }
}

// --- NEW FUNCTION: Create and Save New Project to Drive ---
// Modified to accept optional initial data and return fileId
async function createAndSaveProjectToDrive(projectName, initialProjectData = null) {
    // Log the received project name
    console.log(`[createAndSaveProjectToDrive] Called with projectName: '${projectName}'`);
    if (!googleAccessToken || !gapiInited || !gapi.client.drive) {
        alert("Google Drive is not ready or you are not signed in.");
        return null; // Return null on failure
    }
    console.log(`Creating/Uploading project '${projectName}' for Google Drive...`);

    // 1. Create basic project structure
    let newProject;
    if (initialProjectData) {
        console.log("Using provided initial project data for Drive upload.");
        // Use provided data, but generate new ID and reset driveFileId
        newProject = {
            ...initialProjectData, // Spread existing data (nodes, connections, etc.)
            id: Date.now(), // Generate a new local ID for this instance
            name: projectName, // Ensure name matches the parameter
            lastModified: Date.now(),
            driveFileId: null
        };
        // Ensure essential properties exist if missing in initial data
        if (!newProject.nodes) newProject.nodes = [];
        if (!newProject.connections) newProject.connections = [];
        if (!newProject.canvasOffset) newProject.canvasOffset = { x: 0, y: 0 };
        if (newProject.canvasScale == null) newProject.canvasScale = 1;
    } else {
        console.log("Creating new project structure with welcome node for Drive.");
        // Original behavior: Create new project with welcome node
        newProject = {
            id: Date.now(),
            name: projectName,
            nodes: [],
            connections: [],
            canvasOffset: { x: 0, y: 0 },
            canvasScale: 1,
            lastModified: Date.now(),
            driveFileId: null
        };
        // Add welcome node
        const welcomeNodeId = `node-${Date.now()}-welcome`;
        const welcomeNodeData = {
            id: welcomeNodeId,
            position: { x: 50000 - 150, y: 50000 - 125 },
            content: getWelcomeNodeContent(),
            nodeType: 'default',
            stripColor: stripColors[0]
        };
        newProject.nodes.push(welcomeNodeData);
    }

    // 2. Prepare file metadata and content for Drive API
    const fileName = `${projectName}.mosaic`;
    // Log the generated filename
    console.log(`[createAndSaveProjectToDrive] Generated fileName for Drive: '${fileName}'`);
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: ['root'] // Use root to make files visible
    };
    // Log the coordinates right before stringifying
    console.log("[createAndSaveProjectToDrive] Welcome node coordinates before stringify:",
        newProject.nodes[0]?.position.x, newProject.nodes[0]?.position.y);
    const projectJson = JSON.stringify(newProject, null, 2);
    const media = {
        mimeType: 'application/json',
        body: projectJson
    };

    try {
        console.log("[createAndSaveProjectToDrive] JSON content being prepared:", projectJson);

        // Step 1: Create the file with metadata only using gapi.client.request
        console.log("[createAndSaveProjectToDrive] Step 1: Creating file metadata via gapi.client.request:", metadata);
        try {
            const createResponse = await gapi.client.request({
                path: '/drive/v3/files',
                method: 'POST',
                params: {
                    fields: 'id, name, modifiedTime, iconLink' // Fields to return
                },
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata) // Send metadata as JSON body
            });
            initialDriveFile = createResponse.result;
        } catch (createError) {
            console.error("[createAndSaveProjectToDrive] Step 1 Create Error (gapi.client.request):", createError);
            console.error("[createAndSaveProjectToDrive] Step 1 Create Error Details (gapi.client.request):", JSON.stringify(createError, null, 2));
            throw createError; // Re-throw to be caught by the outer try-catch
        }

        console.log("[createAndSaveProjectToDrive] Step 1 Result (Metadata created, gapi.client.request):", initialDriveFile);

        // Check if the name was set correctly in step 1
        if (!initialDriveFile || !initialDriveFile.id || initialDriveFile.name !== fileName) {
            console.error("[createAndSaveProjectToDrive] Failed to create initial file metadata correctly or name mismatch.", initialDriveFile);
            throw new Error(`Failed to create file placeholder on Drive. Expected name ${fileName} but got ${initialDriveFile?.name}`);
        }

        const driveFileId = initialDriveFile.id;

        // --- ADD Delayed Final Metadata Update (Triggered AFTER Step 1 Success) --- 
        // Schedule this to run after a delay, allowing the main flow (Step 2) to continue
        setTimeout(async () => {
            try {
                console.log(`[createAndSaveProjectToDrive] Delayed Task (2s after Step 1): Performing final metadata update for file ${driveFileId} to set name: ${fileName} via PATCH request.`);
                await gapi.client.request({
                    path: `/drive/v3/files/${driveFileId}`,
                    method: 'PATCH',
                    params: { fields: 'id, name' }, // Request name back to confirm
                    body: JSON.stringify({ name: fileName }) // Just send name in body for PATCH metadata update
                });
                console.log("[createAndSaveProjectToDrive] Delayed Task (2s after Step 1): Final metadata update successful.");
            } catch (finalUpdateError) {
                console.warn("[createAndSaveProjectToDrive] Delayed Task (2s after Step 1): Final metadata update failed:", finalUpdateError);
            }
        }, 15000); // Increased delay to 15 seconds
        // --- End Delayed Final Metadata Update ---

        // Step 2: Update the created file with the actual content using gapi.client.request
        console.log(`[createAndSaveProjectToDrive] Step 2: Updating file ${driveFileId} with content via gapi.client.request.`);
        console.log('[createAndSaveProjectToDrive] Step 2 Body content:', projectJson); // Log the raw JSON string
        try {
            // Use gapi.client.request for the update
            const updateResponse = await gapi.client.request({
                path: `/upload/drive/v3/files/${driveFileId}`, // Use upload path
                method: 'PATCH', // Use PATCH for update
                params: {
                    uploadType: 'media', // Simple media upload type
                    fields: 'id, modifiedTime' // Fields to return
                },
                headers: {
                    'Content-Type': 'application/json' // Specify the content type of the body
                },
                body: projectJson // Send the raw JSON string as the request body
            });

            // Log the full response, not just result
            console.log("[createAndSaveProjectToDrive] Step 2 Full Update Response (gapi.client.request):", updateResponse);
            const updatedDriveFile = updateResponse.result; // Result is typically in .result
            console.log("[createAndSaveProjectToDrive] Step 2 Result (Content updated, gapi.client.request):", updatedDriveFile);
        } catch (updateError) {
            console.error("[createAndSaveProjectToDrive] Step 2 Update Error (gapi.client.request):", updateError);
            console.error("[createAndSaveProjectToDrive] Step 2 Update Error Details (gapi.client.request):", JSON.stringify(updateError, null, 2)); // Log full error
            // Re-throw the error to be caught by the outer try-catch
            throw updateError;
        }

        // Use the initially created file metadata (which includes the name) for local state
        const driveFile = initialDriveFile;

        // 4. Update the local project object with the Drive File ID - DO THIS ONLY LOCALLY
        //    The actual project data on Drive IS newProject
        // newProject.driveFileId = driveFile.id; // Don't modify the object to be saved

        // 5. ---- REMOVED: Adding project locally and switching ----
        // This will now be handled by the calling function using the returned ID

        // Return the Drive File ID on success
        return driveFile.id;

    } catch (error) {
        console.error("Error creating/uploading project on Google Drive:", error);
        // Log detailed error object
        console.error("Drive Create Error Details:", JSON.stringify(error, null, 2));
        alert(`Failed to create project on Google Drive: ${error.message || 'Unknown error'}`);
        // Handle potential authorization error
        if (error.status === 401) {
            googleAccessToken = null;
            updateSignInStatus(false);
            alert("Authorization expired. Please sign in again.");
            if (window.showModal) showModal(document.getElementById('welcome-modal'));
        }
        return null; // Return null on failure
    }
}

// --- Drive Status Indicator Logic ---
let driveStatusIndicator = null;

function createDriveStatusIndicator() {
    if (driveStatusIndicator) return; // Already created

    const historyContainer = document.getElementById('history-buttons');
    if (!historyContainer) {
        console.warn("History buttons container not found. Cannot add Drive status indicator.");
        return;
    }

    const undoButton = document.getElementById('undo-button'); // Find the undo button

    driveStatusIndicator = document.createElement('div');
    driveStatusIndicator.id = 'drive-status-indicator';
    driveStatusIndicator.className = 'drive-status-indicator status-offline'; // Start as offline
    driveStatusIndicator.innerHTML = `
        <span class="status-icon"></span>
        <span class="status-text"></span>
    `;

    // Insert it inside the history container, before the undo button (if found)
    if (undoButton) {
        historyContainer.insertBefore(driveStatusIndicator, undoButton);
    } else {
        // Fallback: append to the container if undo button isn't found
        historyContainer.appendChild(driveStatusIndicator);
    }

    updateDriveStatusIndicator('offline'); // Set initial state text/icon
}

function updateDriveStatusIndicator(status) { // status: 'pending', 'saving', 'synced', 'error'
    if (!driveStatusIndicator) {
        createDriveStatusIndicator(); // Attempt to create if it doesn't exist
        if (!driveStatusIndicator) return; // Stop if creation failed
    }

    const iconEl = driveStatusIndicator.querySelector('.status-icon');
    const textEl = driveStatusIndicator.querySelector('.status-text');
    let iconHTML = '';
    let text = '';
    let tooltip = '';

    // Remove previous status classes
    driveStatusIndicator.className = 'drive-status-indicator';

    switch (status) {
        case 'pending':
            iconHTML = '<i class="fas fa-sync fa-spin"></i>';
            text = 'Pending Save';
            tooltip = 'Changes detected, waiting to save to Drive...';
            driveStatusIndicator.classList.add('status-pending');
            break;
        case 'saving':
            iconHTML = '<i class="fas fa-cloud-upload-alt fa-fade"></i>';
            text = 'Saving...';
            tooltip = 'Saving changes to Google Drive...';
            driveStatusIndicator.classList.add('status-saving');
            break;
        case 'synced':
            iconHTML = '<i class="fas fa-check-circle"></i>';
            text = 'Saved to Drive';
            tooltip = 'All changes saved to Google Drive.';
            driveStatusIndicator.classList.add('status-synced');
            break;
        case 'error':
            iconHTML = '<i class="fas fa-exclamation-triangle"></i>';
            text = 'Sync Error'; // Changed text slightly
            tooltip = 'Could not connect or save to Google Drive. Check connection or sign in again.'; // Updated tooltip
            driveStatusIndicator.classList.add('status-error');
            break;
        default:
            console.warn("Unknown Drive status:", status);
            return;
    }

    iconEl.innerHTML = iconHTML;
    textEl.textContent = text; // Text is hidden by CSS, but keep for potential future use
    driveStatusIndicator.title = tooltip;
}

// Expose for external use if needed, e.g., setting initial state in main.js
window.updateDriveStatusIndicator = updateDriveStatusIndicator;
window.createDriveStatusIndicator = createDriveStatusIndicator;

// --- Token Validity Check --- 
let isCheckingToken = false; // Prevent concurrent checks

async function checkTokenValidity() {
    if (!gapiInited || !googleAccessToken || isCheckingToken) {
        // Don't check if not initialized, not logged in, or already checking
        // Update status based on current knowledge
        updateDriveStatusIndicator(googleAccessToken ? 'pending' : 'offline');
        return googleAccessToken; // Return current token state
    }

    isCheckingToken = true;
    console.log("Checking Google token validity...");
    try {
        // Simple call to check token validity
        await gapi.client.drive.about.get({ fields: 'user' });
        console.log("Token is valid.");
        isCheckingToken = false;
        enableDriveSync(); // Ensure sync is enabled if token is valid
        updateDriveStatusIndicator('synced'); // Or 'pending' if changes exist?
        return true; // Token is valid
    } catch (error) {
        console.error("Token validity check failed:", error);
        isCheckingToken = false;
        if (error.status === 401 || error.result?.error?.code === 401) {
            console.log("Token expired or revoked. Signing out.");
            googleAccessToken = null;
            updateSignInStatus(false); // This calls updateDriveStatusIndicator('error')
            // updateDriveStatusIndicator('offline'); // Already handled by updateSignInStatus
            return false;
        } else {
            console.warn("Drive API error during token check (not 401). Status might be unreliable.");
            updateDriveStatusIndicator('error'); // Ensure error status on other API errors
            return googleAccessToken;
        }
    }
}

// Call this periodically or before critical operations
// Example: Check every 15 minutes (900000 ms)
// setInterval(checkTokenValidity, 900000);
// Or call it in initializeAppUI and before scheduleAutoSave triggers the actual save.

// --- Global Exports ---
window.handleAuthClick = handleAuthClick;
window.handleSignOutClick = handleSignOutClick;
window.openProjectFromDrive = openProjectFromDrive;
window.saveProjectToDrive = saveProjectToDrive;
window.createAndSaveProjectToDrive = createAndSaveProjectToDrive; // Expose the new function
// Expose the flag
Object.defineProperty(window, 'isCreatingForDrive', {
    get: () => isCreatingForDrive,
    set: (value) => { isCreatingForDrive = value; }
});
window.checkTokenValidity = checkTokenValidity; // Expose if needed elsewhere 

// --- MODIFICATION: Add function to attempt silent sign-in ---
/**
 * Attempts to get a token silently when the page loads.
 */
function attemptSilentSignIn() {
    if (googleAccessToken) {
        console.log("attemptSilentSignIn: Already have an access token.");
        return; // Don't attempt if already signed in
    }
    if (tokenClient) {
        console.log("attemptSilentSignIn: Requesting token silently...");
        // Requesting without prompt will attempt silent sign-in
        tokenClient.requestAccessToken({ prompt: '' });
    } else {
        console.warn("attemptSilentSignIn: Token client not ready yet.");
        // It might be too early, maybeEnableAuthControls will eventually call this again?
        // Or we rely on the user clicking the sign-in button.
    }
}
// --- END MODIFICATION --- 