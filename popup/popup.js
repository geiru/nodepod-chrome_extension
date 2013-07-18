Popup = {
    
    server: {
        protocol: 'http',
        host: null,
        port: null
    },
    master: {},
    masterPassword: false,
    Connector: null,
    
    init: function()
    {
        var self = this,
            backgroundPage = chrome.extension.getBackgroundPage();


        // TODO prior to creating a master, get some information about the server in general (e.g. if password for clients is required)

        self.Connector = backgroundPage.Connector;

        if (self._getConnector().isInitialized()) {
            self.loadServer(function() {
                self.master = self._getConnector().master;
                self.masterPassword = self._getConnector().masterPassword;
                self.showMasterInfo();
            })
        }
        else {
            self.loadServer(function() {
                $("#InServerAddress").val(self.server.host);
                $("#InServerPort").val(self.server.port);
            });
            $("#init").show();
            $("#masterInfo").hide();
        }

    },
    
    createMaster: function() {    	
    	var self = this,
            masterName = $('#InMasterName').val(),
            masterPassword = ($('#InMasterPassword') ? $('#InMasterPassword').val() : false);

        self.clearError();

    	self.server.host = $('#InServerAddress').val();
    	self.server.port = $('#InServerPort').val();
    	self.saveServer();

    	// get index
        $.post(self.server.protocol+"://"+self.server.host+":"+self.server.port+'/json/createMaster',
            {
                'master[name]': masterName,
                'master[password]': masterPassword
            },
            function(resp) {

                if (resp.error) {
                    self.showError("Error: Couldn't connect to "+chrome.i18n.getMessage("appName")+". "+resp.error+".");
                }
                else {
                    if (
                        typeof resp.token != 'undefined' && typeof resp.clientPort != 'undefined' &&
                            typeof resp.name != 'undefined'
                        )
                    {

                        self.master = resp;
                        self.masterPassword = masterPassword;
                        self._getConnector().initialize(self.master, self.masterPassword);
                        self._getConnector().connect();
                    }
                    else {
                        self.showError("Error: Couldn't connect to "+chrome.i18n.getMessage("appName")+". Invalid response.");
                    }
                }
            },
            'json'
        )
        .fail(function() {
            self.showError("Error: Couldn't connect to "+chrome.i18n.getMessage("appName")+". Unknown error.");
        });

    },

    disconnectMaster: function() {
        this.clearError();

        this._getConnector().disconnect();
    },

    reconnectMaster: function() {
        this.clearError();

        this._getConnector().connect();
    },

    closeMaster: function() {
        alert('Todo');
    },
    
    showMasterInfo: function() {        
        var self = this,
            i,
            clients = [];

        if (self.master.clients.length) {
            for(i = 0; i < self.master.clients.length; i++) {
                if (self.master.clients[i].parsedUserAgent) {
                    clients.push(self.master.clients[i].host+' '+self.master.clients[i].parsedUserAgent);
                }
            }
        }


        $('#OutMasterName').text(self.master.name);
        $('#OutMasterClientPort').text(self.master.clientPort);
        $('#OutMasterPassword').text(self.masterPassword);
        $('#OutMasterClientUrl').text(self.master.clientUrl);
        $('#OutMasterClients').html(clients.join('<br />'));

        $("#init").hide();
        $("#masterInfo").show();
        $('#ButtonCloseMaster').show();
        if (self._getConnector().isConnected()) {
            $('#ButtonReconnectMaster').hide();
            $('#ButtonDisconnectMaster').show();
        }
        else {
            $('#ButtonReconnectMaster').show();
            $('#ButtonDisconnectMaster').hide();
        }
    }, 

    clearError: function() {
        $("#error").text("");
    },

    showError: function(error) {
        $("#error").text(error);
    },
  
    loadServer: function(callback) {
        var self = this;
        
        // get address and port (if no address saved yet, the default value "" is set)
        chrome.storage.local.get({server: {host: "", port: ""}}, function(items) {
            self.server.host = items.server.host;
            self.server.port = items.server.port;
            
            callback.call();
        });
        
    },
    
    saveServer: function() {
        chrome.storage.local.set({server: {host: this.server.host, port: this.server.port}});
    },

    _getConnector: function() {
        return this.Connector;
    }
};

window.onload = function() {

    /**
     * Register listener for messages from content scripts.
     */
    chrome.extension.onMessage.addListener(
        function(request, sender, sendResponse) {
            switch(request.message) {
                case 'error':
                    Popup.showError("Error: "+request.error+".");
                    break;
                case 'connectSuccess':
                    Popup.showMasterInfo();
                    break;
                case 'disconnectSuccess':
                    Popup.showMasterInfo();
                    break;
            }
        }
    );


    Popup.init();

    $("#ButtonCreateMaster").click(function() {
        Popup.createMaster();
    });

    $("#ButtonDisconnectMaster").click(function() {
        Popup.disconnectMaster();
    });

    $("#ButtonReconnectMaster").click(function() {
        Popup.reconnectMaster();
    });

    $("#ButtonCloseMaster").click(function() {
       Popup.closeMaster();
    });
};