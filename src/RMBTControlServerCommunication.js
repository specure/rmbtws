"use strict";

/**
 * Handles the communication with the ControlServer
 * @param rmbtTestConfig RMBT Test Configuratio
 * @param headers HTTP headers to send in the requests
 * @param testServerConfig Measurement server info
 * @returns Object
 */
export const RMBTControlServerCommunication = (rmbtTestConfig, options, testServerConfig) => {
    const _rmbtTestConfig = rmbtTestConfig;
    const  _logger = log && log.getLogger ? log.getLogger("rmbtws") : new MockLogger();

    options = options || {};
    let _registrationCallback = options.register || null;
    let _submissionCallback = options.submit || null;
    const headers = options.headers || {
        'Content-Type': 'application/json'
    };

    const useLocalServer = _rmbtTestConfig.additionalRegistrationParameters && _rmbtTestConfig.additionalRegistrationParameters.useLocalServer;

    return {
        /**
         *
         * @param {RMBTControlServerRegistrationResponseCallback} onsuccess called on completion
         */
        obtainControlServerRegistration: (onsuccess, onerror) => {
            let json_data = {
                version: _rmbtTestConfig.version,
                language: _rmbtTestConfig.language,
                uuid: _rmbtTestConfig.uuid,
                type: _rmbtTestConfig.type,
                version_code: _rmbtTestConfig.version_code,
                client: _rmbtTestConfig.client,
                timezone: _rmbtTestConfig.timezone,
                time: new Date().getTime(),
                measurement_server_id: testServerConfig ? testServerConfig.id : undefined
            };

            //add additional parameters from the configuration, if any
            Object.assign(json_data, _rmbtTestConfig.additionalRegistrationParameters);

            if (typeof userServerSelection !== "undefined" && userServerSelection > 0 && typeof UserConf !== "undefined" && UserConf.preferredServer !== undefined && UserConf.preferredServer !== "default") {
                json_data['prefer_server'] = UserConf.preferredServer;
                json_data['user_server_selection'] = userServerSelection;
            }

            let response
            fetch(
                _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerRegistrationResource,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(json_data)
                }
            ).then(res => res.json()
            ).then(data => {
                response = data;
                const config = new RMBTControlServerRegistrationResponse(data);
                onsuccess(config);
            }).catch(reason => {
                response = reason;
                _logger.error("error getting testID");
                if (typeof useLocalServer === 'function') {
                    const config = new RMBTControlServerRegistrationResponse(
                        useLocalServer()
                    );
                    onsuccess(config);
                } else {
                    onerror();
                }
            }).finally(() => {
                if (_registrationCallback != null && typeof _registrationCallback === 'function') {
                    _registrationCallback({
                        response: response,
                        request: json_data
                    });
                }
            });
        },

        /**
         * get "data collector" metadata (like browser family) and update config
         *
         */
        getDataCollectorInfo: () => {
            fetch(
                _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerDataCollectorResource,
                {
                    method: 'GET',
                    headers
                }
            ).then(res => res.json()
            ).then(data => {
                _rmbtTestConfig.product = data.agent.substring(0, Math.min(150, data.agent.length));
                _rmbtTestConfig.model = data.product;
                _rmbtTestConfig.os_version = data.version;
            }).catch(() => {
                _logger.error("error getting data collection response");
            });
        },

        /**
         *  Post test result
         *
         * @param {Object}  json_data Data to be sent to server
         * @param {Function} callback
         */
        submitResults: (json_data, onsuccess, onerror) => {
            //add additional parameters from the configuration, if any
            Object.assign(json_data, _rmbtTestConfig.additionalSubmissionParameters);

            let json = JSON.stringify(json_data);
            _logger.debug("Submit size: " + json.length);

            let response;
            fetch(
                _rmbtTestConfig.controlServerURL + _rmbtTestConfig.controlServerResultResource,
                {
                    method: 'POST',
                    headers,
                    body: json
                }
            ).then(res => res.json()
            ).then((data) => {
                response = data;
                _logger.debug(json_data.test_uuid);
                onsuccess(true);
            }).catch((reason) => {
                response = reason;
                _logger.error("error submitting results");
                onerror(false);
            }).finally(() => {
                if (_submissionCallback !== null && typeof _submissionCallback === 'function') {
                    _submissionCallback({
                        response: response,
                        request: json_data
                    });
                }
            });
        }
    };
};