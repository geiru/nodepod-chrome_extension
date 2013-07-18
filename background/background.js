Connector = {

    master: null,
    masterPassword: null,
    socket: null,
    tab: null,

    /**
     * Initialize Connector.
     *
     * @param master the master to connect to via Connector.connect()
     */
    initialize: function(master, masterPassword) {
        this.master = master;
        this.masterPassword = masterPassword;
    },

    /**
     * Reset Connector.
     * Connector.disconnect() must be called first.
     *
     * On error the message 'error' is send.
     * @see Connector.initialize()
     */
    reset: function() {
        if (this.isConnected()) {
            this._error('Still connected. Call disconnect first.');
        }

        this.master = null;
    },

    /**
     * Check if Connector is initialized.
     *
     * @return {Boolean} true if Connector is initialized; false otherwise
     * @see Connector.initialize()
     */
    isInitialized: function() {
        return this.master !== null;
    },

    /**
     * Connect to master.
     *
     * On success Connector.connectSuccessCallback is called.
     * On error Connector.errorCallback is called.
     * @see Connector.initialize()
     */
    connect: function() {
        var self = this;

        if (!self.isInitialized()) {
            self._error('No master to connect.');
            return;
        }

        if (self.isConnected()) {
            self._error('Already connected.');
            return;
        }

        if (self.socket === null) {
            self.socket = io.connect(self.master.socketConnectUrl);

            self.socket.on('connect_error', function(reason) {
                self._error(reason);
            });

            self.socket.on('connect', function() {
                self._onConnect();
                self._connectSuccess();
            });

            self.socket.on('disconnect', function() {
                chrome.tabs.onUpdated.removeListener(self._tabsOnUpdated);
                chrome.tabs.onActivated.removeListener(self._tabsOnActivated);
                self._disconnectSuccess();
            });

            self.socket.on('updateMaster', function(data) {
                var master = data.master;

                self.master = master;
            });
        }
        else {
            self.socket.socket.connect();
        }


    },

    /**
     * Disconnect from master.
     *
     * On success Connector.disconnectSuccessCallback is called.
     * On error Connector.errorCallback is called.
     * @see Connector.initialize()
     */
    disconnect: function() {
        var self = this;

        if (!self.isInitialized()) {
            this._error('No master to disconnect.');
            return;
        }

        if (!self.isConnected()) {
            this._error('Not connected.');
            return;
        }

        self.socket.disconnect();
    },

    /**
     * Check if Connector is connected to the master.
     *
     * @return {Boolean} true if Connector is connected to the master; false otherwise
     * @see Connector.connect()
     */
    isConnected: function() {
        return (this.isInitialized() && this.socket !== null && this.socket.socket.connected);
    },


    /**
     *
     * @param error
     * @private
     */
    _error: function(error) {
        chrome.extension.sendMessage({message: 'error', error: error}, function(response) {});
    },

    /**
     *
     * @private
     */
    _connectSuccess: function () {
        chrome.extension.sendMessage({message: 'connectSuccess'}, function(response) {});
    },

    /**
     *
     * @private
     */
    _disconnectSuccess: function() {
        chrome.extension.sendMessage({message: 'disconnectSuccess'}, function(response) {});
    },



    /**
     * Query for current active tab and register listeners on tabs.
     *
     * @private
     */
    _onConnect: function() {
        var self = this;

        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function(result) {
            self.tab = result.pop();
            self._updateTab();
        });

        // url in any tab changes
        chrome.tabs.onUpdated.addListener(self._tabsOnUpdated);

        // active tab changes
        chrome.tabs.onActivated.addListener(self._tabsOnActivated);
    },

    /**
     * Called on update of a tab.
     *
     * @param tabId
     * @param changeInfo
     * @param tab
     * @private
     */
    _tabsOnUpdated: function(tabId, changeInfo, tab) {
        var self = Connector;

        if (changeInfo.url) {
            self.tab = tab;
            self._updateTab();
        }
    },

    /**
     * Called on activation of a tab.
     *
     * @param activeInfo
     * @private
     */
    _tabsOnActivated: function(activeInfo) {
        var self = Connector;

        chrome.tabs.get(activeInfo.tabId, function(tab) {
            self.tab = tab;
            self._updateTab();
        });
    },

    /**
     * Emit updateUrl event and inject content scripts in current tab.
     *
     * @private
     */
    _updateTab: function() {
        var url = this.tab.url;

        // ignore all urls that do not start with http or https
        // the url is filtered on the server too, but we get errors if we try to inject scripts on pages like chrome://chrome/extensions/
        if (url.search(/https?:\/\//) !== 0) {
            return false;
        }

        this.emitUpdateUrl(url);

        // TODO: check if already executed
        chrome.tabs.executeScript(this.tab.id, {file: 'vendors/jquery-1.8.3.min.js'});
        chrome.tabs.executeScript(this.tab.id, {file: 'content_script/content_script.js'});
    },

    /**
     * Emit updateUrl event.
     *
     * @param url
     */
    emitUpdateUrl: function(url) {
        this._emit('updateUrl', {url: url});
    },

    /**
     * Emit click event.
     *
     * @param element
     */
    emitClick: function(element) {
        this._emit('click', {element: element});
    },

    /**
     * Emit an event.
     *
     * @param event
     * @param data
     * @private
     */
    _emit: function(event, data) {
        if (!this.isConnected()) {
            return;
        }

        this.socket.emit(event, data);
    }

};

/**
 * Register listener for messages from content scripts.
 */
chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.message) {
        case 'click':
            Connector.emitClick(request.element);
            sendResponse();
            break;
    }
});