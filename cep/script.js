
const addressForm = document.querySelector('#address-form');
const cepForm = document.querySelector('#cep-form');

const tabs = document.querySelectorAll('.tab');

const resultsSection = document.querySelector('#results-section');
const results = document.querySelector('#results');

const toast = document.querySelector('#toast');

// AVISOS NA TELA

function notify(message) {

    toast.textContent = message;

    toast.classList.add('show');

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2600);

}

// TROCAR TIPO DE PESQUISA

function changeMode(mode) {

    const byAddress = mode === 'address';

    addressForm.classList.toggle('hidden', !byAddress);

    cepForm.classList.toggle('hidden', byAddress);

    tabs.forEach(tab => {

        const active = tab.dataset.mode === mode;

        tab.classList.toggle('active', active);

        tab.setAttribute(
            'aria-selected',
            String(active)
        );

    });

    resultsSection.classList.add('hidden');

}

tabs.forEach(tab => {

    tab.addEventListener('click', () => {
        changeMode(tab.dataset.mode);
    });

});

// NORMALIZAR TEXTO

function normalize(value) {

    return (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

}

// MOSTRAR RESULTADOS

function renderResults(items, title = 'Endereços encontrados') {

    document.querySelector('#results-title').textContent = title;

    document.querySelector('#result-count').textContent =
        `${items.length} ${
            items.length === 1 ? 'resultado' : 'resultados'
        }`;

    results.replaceChildren();

    if (!items.length) {

        const empty = document.createElement('div');

        empty.className = 'empty';

        empty.textContent =
            'Nenhum CEP foi encontrado com esses dados. ' +
            'Tente informar uma rua ou confira a grafia ' +
            'do bairro e da cidade.';

        results.append(empty);

    }

    items.forEach(item => {

        const card = document.createElement('article');

        card.className = 'result-card';

        const info = document.createElement('div');

        const name = document.createElement('h3');

        name.textContent =
            item.logradouro || item.bairro || 'Endereço';

        const details = document.createElement('p');

        details.textContent = [
            item.bairro,
            item.localidade,
            item.uf
        ].filter(Boolean).join(' • ');

        const cep = document.createElement('div');

        cep.className = 'cep-number';

        cep.textContent = item.cep || 'CEP indisponível';

        info.append(name, details, cep);

        const copy = document.createElement('button');

        copy.className = 'copy';

        copy.type = 'button';

        copy.textContent = 'Copiar CEP';

        copy.addEventListener('click', async () => {

            try {

                await navigator.clipboard.writeText(item.cep);

                notify('CEP copiado!');

            } catch {

                notify('Não foi possível copiar automaticamente.');

            }

        });

        card.append(info, copy);

        results.append(card);

    });

    resultsSection.classList.remove('hidden');

    resultsSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

}

// BUSCAR POR BAIRRO, RUA, CIDADE E ESTADO

addressForm.addEventListener('submit', async event => {

    event.preventDefault();

    const bairro = document
        .querySelector('#bairro')
        .value.trim();

    const rua = document
        .querySelector('#rua')
        .value.trim();

    const cidade = document
        .querySelector('#cidade')
        .value.trim();

    const uf = document
        .querySelector('#estado')
        .value;

    if (!bairro && !rua) {

        notify('Informe pelo menos um bairro ou uma rua.');

        return;

    }

    const searchTerm = rua || bairro;

    const button = addressForm.querySelector('.submit');

    button.disabled = true;

    button.textContent = 'Pesquisando...';

    try {

        /*
         * ViaCEP:
         * https://viacep.com.br/ws/UF/CIDADE/LOGRADOURO/json/
         *
         * O terceiro parâmetro é um logradouro.
         * A busca por bairro é uma tentativa de encontrar
         * logradouros relacionados ao nome informado.
         */

        const url =
            `https://viacep.com.br/ws/` +
            `${encodeURIComponent(uf)}/` +
            `${encodeURIComponent(cidade)}/` +
            `${encodeURIComponent(searchTerm)}/json/`;

        const response = await fetch(url);

        if (!response.ok) {

            throw new Error('Serviço indisponível');

        }

        const data = await response.json();

        if (!Array.isArray(data)) {

            renderResults([], 'Nenhum endereço encontrado');

            return;

        }

        let matches = data;

        // FILTRAR PELO BAIRRO

        if (bairro && !rua) {

            matches = data.filter(item => {

                return normalize(item.bairro)
                    .includes(normalize(bairro));

            });

        } else if (bairro && rua) {

            matches = data.filter(item => {

                return normalize(item.bairro)
                    .includes(normalize(bairro));

            });

        }

        // REMOVER CEPs DUPLICADOS

        const unique = [
            ...new Map(
                matches
                    .filter(item => item.cep)
                    .map(item => [item.cep, item])
            ).values()
        ];

        renderResults(
            unique,
            bairro && !rua
                ? 'CEPs encontrados para o bairro'
                : 'Endereços encontrados'
        );

        if (!unique.length) {

            notify(
                'A busca por bairro não encontrou correspondências. Tente informar uma rua.'
            );

        }

    } catch (error) {

        console.error(error);

        notify(
            'Erro ao consultar o ViaCEP. Verifique sua conexão.'
        );

    } finally {

        button.disabled = false;

        button.innerHTML = 'Buscar CEP <span>→</span>';

    }

});

// BUSCAR DIRETAMENTE PELO CEP

cepForm.addEventListener('submit', async event => {

    event.preventDefault();

    const cep = document
        .querySelector('#cep-input')
        .value
        .replace(/\D/g, '');

    if (cep.length !== 8) {

        notify('Digite um CEP válido com 8 números.');

        return;

    }

    const button = cepForm.querySelector('.submit');

    button.disabled = true;

    button.textContent = 'Consultando...';

    try {

        const response = await fetch(
            `https://viacep.com.br/ws/${cep}/json/`
        );

        if (!response.ok) {

            throw new Error('Serviço indisponível');

        }

        const data = await response.json();

        if (data.erro) {

            renderResults([], 'CEP não encontrado');

        } else {

            renderResults(
                [data],
                'Endereço correspondente'
            );

        }

    } catch (error) {

        console.error(error);

        notify(
            'Não foi possível consultar o CEP. Verifique sua conexão.'
        );

    } finally {

        button.disabled = false;

        button.innerHTML =
            'Consultar endereço <span>→</span>';

    }

});

// FORMATAÇÃO AUTOMÁTICA DO CEP

document
    .querySelector('#cep-input')
    .addEventListener('input', event => {

        const digits = event.target.value
            .replace(/\D/g, '')
            .slice(0, 8);

        event.target.value =
            digits.length > 5
                ? `${digits.slice(0, 5)}-${digits.slice(5)}`
                : digits;

    });
