export class JournalLink {
    re = /@(\w+)\[(\w+)\]/g;

    entityMap = {
        'JournalEntry': 'journal',
        'Actor': 'actors',
        'Item': 'items',
        'RollTable': 'tables'
    };

    updateJournalEntry({ data }) {
        this.update(data, 'JournalEntry');
    }

    // TODO is the lack of async/await here going to bite me?
    update(data, entityType) {
        console.log('journal-links | updating ' + entityType + ' ' + data.name);

        let references = this.references(data.content);
        let existing = (data.flags['journal-links'] && data.flags['journal-links']['references']) || {};

        let updated = {};

        for (let reference of references) {
            if (!updated[reference.type])
                updated[reference.type] = [];
            // if we've linked something multiple times in this entity
            if (updated[reference.type].includes(reference.id))
                continue
            updated[reference.type].push(reference.id);

            let existingOfType = existing[reference.type] || [];
            if (existingOfType.includes(reference.id))
                continue;

            let referenced = game[this.entityMap[reference.type]].get(reference.id);
            let links = referenced.getFlag('journal-links', 'referencedBy') || {};
            let linksOfType = links[entityType] || [];
            linksOfType.push(data._id);

            links[entityType] = linksOfType;
            referenced.setFlag('journal-links', 'referencedBy', links);
        }

        for (const [type, values] of Object.entries(existing)) {
            let current = updated[type];
            for (let outdated of values.filter(v => !current.includes(v))) {
                let entity = game[this.entityMap[type]].get(outdated);

                let links = entity.getFlag('journal-links', 'referencedBy');
                let linksOfType = links[type];
                linksOfType.splice(linksOfType.indexOf(data._id), 1);

                if (linksOfType.length)
                    links[type] = linksOfType;
                else
                    delete links[type];
                entity.setFlag('journal-links', 'referencedBy', links);
            }
        };

        game[this.entityMap[entityType]].get(data._id).setFlag('journal-links', 'references', updated);
    }

    includeLinks(sheet, html, data) {
        let links = data.entity.flags && data.entity.flags['journal-links'] && data.entity.flags['journal-links']['referencedBy'] || {};
        if (Object.keys(links).length === 0)
            return;

        console.log('journal-links | appending links to ' + data.entity.name);
        let element = html.find(".editor-content");
        if (element.length === 0)
            return;

        let linksDiv = $('<div class="journal-links"></div>');
        linksDiv.append($('<h1>Linked from</h1>'));
        for (const [type, values] of Object.entries(links)) {
            if (values.length === 0)
                continue;

            linksDiv.append($('<h2>' + type + '</h2>'));
            let linksList = $('<ul></ul>');
            for (let value of values) {
                let entity = game[this.entityMap[type]].get(value);
                let link = $('<a class="entity-link" draggable="true"></a>');
                link.attr('data-entity', type);
                link.attr('data-id', entity._id);

                let icon = 'fas ';
                switch (type) {
                    case 'JournalEntry':
                        icon += 'fa-book-open';
                        break;
                    case 'Actor':
                        icon += 'fa-user';
                        break;
                    case 'Item':
                        icon += 'fa-suitcase';
                        break;
                    case 'RollTable':
                        icon == 'fa-th-list';
                        break;
                }
                link.append($('<i class="' + icon + '"></i>'));
                link.append(' ' + entity.name);

                let li = $('<li></li>');
                li.append(link);
                linksList.append(li);
            }
            linksDiv.append(linksList);
        }
        element.append(linksDiv);
    }

    references(text) {
        return Array.from(text.matchAll(this.re)).map(
            m => {
                return {
                    type: m[1],
                    id: m[2]
                }
            }
        );
    }
}
