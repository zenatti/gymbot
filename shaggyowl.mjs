import fetch from 'node-fetch';

const MOCK_DATA = {
    loginApp: false,
    selezionaSede: false,
    palinsesti: false,
    prenotazione: true
};

/**
 *
 * @param body
 * @returns {string}
 */
const jsonToFormBody = (body) => {
    let formBody = [];
    for (let property in body) {
        let encodedKey = encodeURIComponent(property);
        let encodedValue = encodeURIComponent(body[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    return formBody.join("&");
}

/**
 *
 * @param user
 * @param pwd
 * @returns {Promise<unknown>}
 */
const loginApp = async function (user, pwd) {

    if (MOCK_DATA.loginApp) {
        console.warn("MOCK DATA", "loginApp");
        return Promise.resolve({});
    }

    const response = await fetch('https://app.shaggyowl.com/funzioniapp/v404/loginApp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: jsonToFormBody({
            pass: pwd,
            versione: "13",
            tipo: "web",
            mail: user
        })
    });
    return await response.json();
};

/**
 *
 * @param id_sede
 * @param codice_sessione
 * @returns {Promise<unknown>}
 */
const selezionaSede = async function (id_sede, codice_sessione) {

    if (MOCK_DATA.selezionaSede) {
        console.warn("MOCK DATA", "selezionaSede");
        return Promise.resolve({});
    }

    const response = await fetch('https://app.shaggyowl.com/funzioniapp/v404/selezionaSede', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: jsonToFormBody({
            id_sede_selezionata: id_sede,
            codice_sessione: codice_sessione
        })
    });
    return await response.json();
};

/**
 *
 * @param id_sede
 * @param codice_sessione
 * @param giorno
 * @returns {Promise<unknown>}
 */
const palinsesti = async function (id_sede, codice_sessione, giorno) {

    if (MOCK_DATA.palinsesti) {
        console.warn("MOCK DATA", "palinsesti");
        return Promise.resolve({});
    }

    const response = await fetch('https://app.shaggyowl.com/funzioniapp/v404/palinsesti', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: jsonToFormBody({
            id_sede: id_sede,
            codice_sessione: codice_sessione,
            giorno: giorno
        })
    });
    return await response.json();
};

/**
 *
 * @param id_sede
 * @param codice_sessione
 * @param data
 * @param id_orario_palinsesto
 * @returns {Promise<unknown>}
 */
const prenotazione = async function (id_sede, codice_sessione, data, id_orario_palinsesto) {

    if (MOCK_DATA.prenotazione) {
        console.warn("MOCK DATA", "prenotazione");
        return Promise.resolve({
            status: 2,
            messaggio: 'Sei in CODA per questa lezione.',
            parametri: {
                data_alert: '31-12-2300 23:59:59',
                frase: 'Sei in CODA per il corso Cross training delle ore 18:00. Ricontrolla la situazione.',
                prenotazione: {
                    id_prenotazione: '38393518',
                    stato: '1',
                    data: '18-03-2022',
                    coda_clienti: '0',
                    frase: 'Hai 0 clienti in coda prima di te',
                    nome_corso: 'Cross training',
                    orario_inizio: '18:00',
                    orario_fine: '18:50'
                },
                banner: {}
            }
        });
    }

    const response = await fetch('https://app.shaggyowl.com/funzioniapp/v404/prenotazione_new', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: jsonToFormBody({
            id_sede: id_sede,
            codice_sessione: codice_sessione,
            id_orario_palinsesto: id_orario_palinsesto,
            data: data
        })
    });
    return await response.json();
};

export {loginApp, selezionaSede, palinsesti, prenotazione};

/*

 https://app.shaggyowl.com/funzioniapp/v404/cancella_prenotazione

 id_sede: 7220
 codice_sessione: g2AykAaTmJuI6Fkq3XjI
 id_prenotazione: 38301555
 tipo: prenotazione

 */


