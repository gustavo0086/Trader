"use strict";

window.BULK && BULK.stop();

window.BULK = {
    _control: null,
    _controlPaused: null,
    _controlRunning: null,
    _controlSendingForce: null,
    _controls: null,
    _item: null,
    _itemById: {},
    _itemByAccountName: {},
    _jQuery: null,
    _loopIntervalId: null,
    _loopLastCleaned: null,
    _loopLastRefreshing: null,
    _quantityByAccountName: {},
    _mutationObserver: null,
    _notification: null,
    _TEMPLATES: {
        CONTROL: '<div id="bulk-control-running"><button title="Click to pause" type="button" style="position:fixed;right:88px;bottom:20px;width:48px;height:48px;display:flex;align-items:center;z-index:500;background-color:#0f304d;border:1px solid #4c4c7d;color:#fff;"><svg fill="white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="12" r="3" opacity="1"><animate id="spinner_qYjJ" begin="0;spinner_t4KZ.end-0.25s" attributeName="opacity" dur="0.75s" values="1;.2" fill="freeze"/></circle><circle cx="12" cy="12" r="3" opacity=".4"><animate begin="spinner_qYjJ.begin+0.15s" attributeName="opacity" dur="0.75s" values="1;.2" fill="freeze"/></circle><circle cx="20" cy="12" r="3" opacity=".3"><animate id="spinner_t4KZ" begin="spinner_qYjJ.begin+0.3s" attributeName="opacity" dur="0.75s" values="1;.2" fill="freeze"/></circle></svg></button></div><div id="bulk-control-paused"><button title="Click to resume" type="button" style="position:fixed;right:88px;bottom:20px;width:48px;height:48px;display:flex;align-items:center;z-index:500;background-color:#0f304d;border:1px solid #4c4c7d;color:#fff;"><svg fill="white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="12" r="3" opacity="1"></circle><circle cx="12" cy="12" r="3" opacity=".4"></circle><circle cx="20" cy="12" r="3" opacity=".3"></circle></svg></button></div>',
        CONTROLS: '<div class="filter-group" id="bulk-controls"><div class="filter-group-header"><div class="filter"><span class="input-group-btn" style="visibility:hidden;"><button class="btn toggle-btn"></button></span><span class="filter-body"><span class="filter-title filter-title-clickable"><span>POE Bulk</span></span></span></div></div><div class="filter-group-body">' +
            '<div class="filter filter-property full-span"><span class="filter-body"><div class="filter-title">Force trading when the item is in demand</div><span class="sep"></span><label style="display:flex;justify-content:center;align-items: center;background:#1e2124;height:30px;width:30px;float:left;margin:0;cursor:pointer;"><input type="checkbox" style="display:block;border:2px solid #634928;background:#000000;" id="bulk-controls-sending-force" checked="checked"></label></span></div></div></div>',
        NOTIFICATION: '<div class="toast-container toast-bottom-center"><div class="toast toast-STATE" style="display:block;"><div class="toast-title"></div> <div class="toast-message">MESSAGE</div></div></div>',
    },
    start: function() {
        const me = BULK;

        if (!me._jQuery) {
            const jQuery = $;

            if (!jQuery) {
                console.error('POE Bulk: No jQuery.');
                return;
            }

            me._jQuery = jQuery;
        }

        if (!MutationObserver) {
            me._notify('error', 'POE Bulk: No MutationObserver.');
            return;
        }

        const jQuery = me._jQuery;

        if (!me._mutationObserver) {
            me._mutationObserver = new MutationObserver(me._onMutation);
        }

        const $results = jQuery('.results');

        if (!$results.length) {
            me._notify('error', 'POE Bulk: No result container.');
            return;
        }

        if (!me._control) {
            const $trade = jQuery('#trade');

            if (!$trade.length) {
                me._notify('error', 'POE Bulk: No trade container.');
                return;
            }

            me._control = jQuery(me._TEMPLATES.CONTROL);
            $trade.append(me._control);

            me._controlRunning = jQuery('#bulk-control-running');
            me._controlPaused = jQuery('#bulk-control-paused');

            me._controlRunning.find('button').click(function () {
                me._controlStart('paused');
            });

            me._controlPaused.find('button').click(function () {
                me._controlStop();
            });

            me._controlStop();
        }

        if (!me._controls) {
            const $filtersContainer = jQuery('.search-advanced-pane.blue');

            if (!$filtersContainer.length) {
                me._notify('error', 'POE Bulk: No filters container.');
                return;
            }

            me._controls = jQuery(me._TEMPLATES.CONTROLS);
            $filtersContainer.append(me._controls);

            me._controlSendingForce = jQuery('#bulk-controls-sending-force');
        }

        jQuery(document).on('ajaxComplete', me._onAjax);

        if (!me._loopIntervalId) {
            me._loopIntervalId = setInterval(me._loop, 50);
        }

        me._mutationObserver.disconnect();
        me._mutationObserver.observe($results.get(0), { attributeFilter: ['class'], childList: true, subtree: true });

        me._notify('success', 'POE Bulk has started.');
    },
    stop: function() {
        const me = BULK;
        const control = me._control;
        const controls = me._controls;
        const jQuery = me._jQuery;
        const loopIntervalId = me._loopIntervalId;
        const mutationObserver = me._mutationObserver;
        const notification = me._notification;

        if (control) {
            control.remove();
        }

        if (controls) {
            controls.remove();
        }

        if (loopIntervalId) {
            clearInterval(loopIntervalId);
        }

        if (mutationObserver) {
            mutationObserver.disconnect();
        }

        if (notification) {
            notification.remove();
        }

        jQuery(document).off('ajaxComplete', me._onAjax);

        me._control = null;
        me._controlPaused = null;
        me._controlRunning = null;
        me._controlSendingForce = null;
        me._controls = null;
        me._item = null;
        me._loopIntervalId = null;
        me._loopLastCleaned = null;
        me._loopLastRefreshing = null;
        me._itemById = {};
        me._itemByAccountName = {};
        me._jQuery = null;
        me._quantityByAccountName = {};
        me._mutationObserver = null;
        me._notification = null;
    },
    _controlStart: function(id) {
        const me = BULK;

        me._controlRunning.toggle(false);
        me._controlPaused.toggle(true)
        me._controlPaused.find('button').css('border-color', 'rate-limited' === id ? 'orange' : '#4c4c7d');

        me._item = id;
    },
    _controlStop: function() {
        const me = BULK;

        me._controlRunning.toggle(true);
        me._controlPaused.toggle(false);
        me._item = null;
    },
    _loop: function () {
        const me = BULK;
        const item = me._item;

        if ('paused' !== item && 'rate-limited' !== item && null !== item && (null === me._loopLastRefreshing || 5000 < Date.now() - me._loopLastRefreshing)) {
            const $rows = me._jQuery('.row[data-id="' + item + '"]');

            if (!$rows.length || $rows.is('.gone')) {
                me._controlStop();
            } else {
                me._loopLastRefreshing = Date.now();
                $rows.find('button.refresh:not(.refreshing)').first().get(0)?.click();
            }
        }

        if (null === me._item) {
            const $candidateTrading = me._jQuery('.results .row[data-id]:not(.gone) .direct-btn:not(.expired.disabled)').first();

            if ($candidateTrading.length) {
                me._controlStart($candidateTrading.closest('[data-id]').data('id'));
                $candidateTrading.get(0)?.click();
            }
        }

        if (null === me._item && (null === me._loopLastCleaned || 5000 < Date.now() - me._loopLastCleaned) && !me._jQuery('.results .row[data-id]:not(.gone) .refresh.refreshing').length) {
            const $candidateCleaning = me._jQuery('.results .row[data-id]:not(.gone) .refresh:not(.refreshing)').first();

            if ($candidateCleaning.length) {
                me._loopLastCleaned = Date.now();
                $candidateCleaning.get(0)?.click();
            }
        }
    },
    _notify: function(state, message) {
        const me = BULK;
        const notification = me._notification;
        const jQuery = me._jQuery;
        const $notification = jQuery(me._TEMPLATES.NOTIFICATION.replace('STATE', state).replace('MESSAGE', message));

        if (notification) {
            notification.remove();
        }

        jQuery('body').append($notification);

        me._notification = $notification;

        setTimeout(function() {
            const notification = me._notification;

            if (notification) {
                notification.remove();
                me._notification = null;
            }
        }, 2500);
    },
    _onAjax: function(event, xhr, settings ) {
        const me = BULK;

        if (200 === xhr.status && settings.url.startsWith('/api/trade/fetch/')) {
            me._onAjaxDone(xhr.responseJSON);
        } else if (429 === xhr.status) {
            me._controlStart('rate-limited');
        }
    },
    _onAjaxDone: function(data) {
        if (data && data.result) {
            const me = BULK;

            for (const result of data.result) {
                if (null !== result && typeof result === "object" && !Array.isArray(result)) {
                    const id = result.id || null;

                    if (id) {
                        const gone = result.gone || false;
                        const listingJSON = result.listing || {};
                        const hideout = listingJSON.hideout_token || null;

                        if (gone || !hideout) {
                            me._itemRemove(id);
                            continue;
                        }

                        const accountJSON = listingJSON.account || {};
                        const itemJSON = result.item || {};
                        const priceJSON = listingJSON.price || {};
                        const priceItemJSON = priceJSON.item || {};

                        me._itemAdd({
                            id,
                            accountName: accountJSON.name || null,
                            fee: listingJSON.fee || 0,
                            league: itemJSON.league || null,
                            stock: priceItemJSON.stock || itemJSON.stackSize || 1,
                            timestamp: Date.now()
                        });
                    }
                }
            }
        }
    },
    _isEmpty: function(object) {
        for (const _ in object) {
            return false;
        }

        return true;
    },
    _itemAdd: function(item) {
        const me = BULK;

        me._itemById[item.id] = item;

        if (!me._itemByAccountName[item.accountName]) {
            me._itemByAccountName[item.accountName] = {};
        }

        me._itemByAccountName[item.accountName][item.id] = null;

        if (me._quantityByAccountName[item.accountName]) {
            me._quantityByAccountName[item.accountName].fee += item.fee;
            me._quantityByAccountName[item.accountName].stock += item.stock;
        } else {
            me._quantityByAccountName[item.accountName] = {
                fee: item.fee,
                stock: item.stock,
            };
        }
    },
    _itemRemove: function(id) {
        const me = BULK;

        if (me._item === id) {
            me._controlStop();
        }

        const item = me._itemById[id];

        if (item) {
            if (me._quantityByAccountName[item.accountName]) {
                me._quantityByAccountName[item.accountName].fee -= item.fee;
                me._quantityByAccountName[item.accountName].stock -= item.stock;

                if (0 >= me._quantityByAccountName[item.accountName].stock) {
                    delete me._quantityByAccountName[item.accountName];
                }
            }

            if (me._itemByAccountName[item.accountName]) {
                delete me._itemByAccountName[item.accountName][id];

                if (me._isEmpty(me._itemByAccountName[item.accountName])) {
                    delete me._itemByAccountName[item.accountName];
                }
            }

            delete me._itemById[id];
        }
    },
    _onMutation: function(mutationRecords) {
        mutationRecords.forEach(BULK._onMutationRecord);
    },
    _onMutationRecord: function(mutationRecord) {
        const me = BULK;

        mutationRecord.addedNodes.forEach(me._onMutationRecordAdded);

        if ('attributes' === mutationRecord.type) {
            BULK._onMutationRecordAttributeEdited(mutationRecord);
        }
    },
    _onMutationRecordAdded: function(node) {
        const me = BULK;
        const $node = me._jQuery(node);

        if ($node.is('[data-id]')) {
            const id = $node.data('id');

            if (null === me._item) {
                me._controlStart(id);
                $node.find('.direct-btn:not(.disabled)').get(0)?.click();
                return;
            }

            const item = me._itemById[id];

            if (item) {
                // TODO Is it better (cheaper, with a larger stock, etc.) to switch to it?
            }
        }
    },
    _onMutationRecordAttributeEdited: function(mutationRecord) {
        const me = BULK;
        const $target = me._jQuery(mutationRecord.target);

        if ($target.is('.row.gone')) {
            me._itemRemove($target.data('id'));
            return;
        }

        if (!me._controlSendingForce.is(':checked')) {
            return;
        }

        if ($target.is('.direct-btn.expired:not(.disabled)')) {
            const $row = $target.closest('[data-id]');
            const id = $row.data('id');

            if ($row.is('.gone')) {
                me._itemRemove(id);
            } else if (id === me._item) {
                $target.get(0)?.click();
            }
        }
    }
};

BULK.start();
