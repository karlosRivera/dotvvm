/// <reference path="typings/knockout/knockout.d.ts" />
/// <reference path="typings/knockout.mapper/knockout.mapper.d.ts" />
/// <reference path="typings/globalize/globalize.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Redwood = (function () {
    function Redwood() {
        this.postBackCounter = 0;
        this.extensions = {};
        this.viewModels = {};
        this.events = {
            init: new RedwoodEvent("redwood.events.init", true),
            beforePostback: new RedwoodEvent("redwood.events.beforePostback"),
            afterPostback: new RedwoodEvent("redwood.events.afterPostback"),
            error: new RedwoodEvent("redwood.events.error"),
            spaNavigating: new RedwoodEvent("redwood.events.spaNavigating"),
            spaNavigated: new RedwoodEvent("redwood.events.spaNavigated")
        };
    }
    Redwood.prototype.init = function (viewModelName, culture) {
        this.culture = culture;
        this.viewModels[viewModelName].viewModel = ko.mapper.fromJS(this.viewModels[viewModelName].viewModel);
        var viewModel = this.viewModels[viewModelName].viewModel;
        ko.applyBindings(viewModel, document.documentElement);
        this.events.init.trigger(new RedwoodEventArgs(viewModel));
        if (document.location.hash.indexOf("#/") === 0) {
            this.navigateSpaCore(viewModelName, document.location.hash.substring(1));
        }
    };
    Redwood.prototype.backUpPostBackConter = function () {
        this.postBackCounter++;
        return this.postBackCounter;
    };
    Redwood.prototype.isPostBackStillActive = function (currentPostBackCounter) {
        return this.postBackCounter === currentPostBackCounter;
    };
    Redwood.prototype.postBack = function (viewModelName, sender, path, command, controlUniqueId, validationTargetPath) {
        var _this = this;
        var viewModel = this.viewModels[viewModelName].viewModel;
        // prevent double postbacks
        var currentPostBackCounter = this.backUpPostBackConter();
        // trigger beforePostback event
        var beforePostbackArgs = new RedwoodBeforePostBackEventArgs(sender, viewModel, viewModelName, validationTargetPath);
        this.events.beforePostback.trigger(beforePostbackArgs);
        if (beforePostbackArgs.cancel) {
            // trigger afterPostback event
            var afterPostBackArgsCanceled = new RedwoodAfterPostBackEventArgs(sender, viewModel, viewModelName, validationTargetPath, null);
            afterPostBackArgsCanceled.wasInterrupted = true;
            this.events.afterPostback.trigger(afterPostBackArgsCanceled);
            return;
        }
        // perform the postback
        this.updateDynamicPathFragments(sender, path);
        var data = {
            viewModel: ko.mapper.toJS(viewModel),
            currentPath: path,
            command: command,
            controlUniqueId: controlUniqueId,
            validationTargetPath: validationTargetPath || null
        };
        this.postJSON(this.viewModels[viewModelName].url, "POST", ko.toJSON(data), function (result) {
            // if another postback has already been passed, don't do anything
            if (!_this.isPostBackStillActive(currentPostBackCounter)) {
                var afterPostBackArgsCanceled = new RedwoodAfterPostBackEventArgs(sender, viewModel, viewModelName, validationTargetPath, null);
                afterPostBackArgsCanceled.wasInterrupted = true;
                _this.events.afterPostback.trigger(afterPostBackArgsCanceled);
                return;
            }
            var resultObject = JSON.parse(result.responseText);
            if (!resultObject.viewModel && resultObject.viewModelDiff) {
                resultObject.viewModel = _this.patch(data.viewModel, resultObject.viewModelDiff);
            }
            var isSuccess = false;
            if (resultObject.action === "successfulCommand") {
                // remove updated controls
                var updatedControls = _this.cleanUpdatedControls(resultObject);
                // update the viewmodel
                if (resultObject.viewModel)
                    ko.mapper.fromJS(resultObject.viewModel, {}, _this.viewModels[viewModelName].viewModel);
                isSuccess = true;
                // add updated controls
                _this.restoreUpdatedControls(resultObject, updatedControls, true);
            }
            else if (resultObject.action === "redirect") {
                // redirect
                document.location.href = resultObject.url;
                return;
            }
            // trigger afterPostback event
            var afterPostBackArgs = new RedwoodAfterPostBackEventArgs(sender, viewModel, viewModelName, validationTargetPath, resultObject);
            _this.events.afterPostback.trigger(afterPostBackArgs);
            if (!isSuccess && !afterPostBackArgs.isHandled) {
                throw "Invalid response from server!";
            }
        }, function (xhr) {
            // if another postback has already been passed, don't do anything
            if (!_this.isPostBackStillActive(currentPostBackCounter))
                return;
            // execute error handlers
            var errArgs = new RedwoodErrorEventArgs(viewModel, xhr);
            _this.events.error.trigger(errArgs);
            if (!errArgs.handled) {
                alert(xhr.responseText);
            }
        });
    };
    Redwood.prototype.evaluateOnViewModel = function (context, expression) {
        return eval("(function (c) { return c." + expression + "; })")(context);
    };
    Redwood.prototype.navigateSpa = function (sender, viewModelName, routePath, parametersProvider) {
        var viewModel = ko.dataFor(sender);
        // compose the final URL and navigate
        var url = "/" + this.buildRouteUrl(routePath, parametersProvider(viewModel));
        document.location.hash = url;
        this.navigateSpaCore(viewModelName, url);
    };
    Redwood.prototype.navigateSpaCore = function (viewModelName, url) {
        var _this = this;
        var viewModel = this.viewModels[viewModelName].viewModel;
        // prevent double postbacks
        var currentPostBackCounter = this.backUpPostBackConter();
        // trigger spaNavigating event
        var spaNavigatingArgs = new RedwoodSpaNavigatingEventArgs(viewModel, viewModelName, url);
        this.events.spaNavigating.trigger(spaNavigatingArgs);
        if (spaNavigatingArgs.cancel) {
            return;
        }
        // send the request
        var spaPlaceHolderUniqueId = document.getElementsByName("__rw_SpaContentPlaceHolder")[0].attributes["data-rw-spacontentplaceholder"].value;
        this.getJSON(url, "GET", spaPlaceHolderUniqueId, function (result) {
            // if another postback has already been passed, don't do anything
            if (!_this.isPostBackStillActive(currentPostBackCounter))
                return;
            var resultObject = JSON.parse(result.responseText);
            var isSuccess = false;
            if (resultObject.action === "successfulCommand") {
                // remove updated controls
                var updatedControls = _this.cleanUpdatedControls(resultObject);
                // update the viewmodel
                ko.cleanNode(document.documentElement);
                _this.viewModels[viewModelName] = {
                    viewModel: {},
                    url: resultObject.url,
                    action: resultObject.action
                };
                ko.mapper.fromJS(resultObject.viewModel, {}, _this.viewModels[viewModelName].viewModel);
                isSuccess = true;
                // add updated controls
                _this.restoreUpdatedControls(resultObject, updatedControls, false);
                ko.applyBindings(_this.viewModels[viewModelName].viewModel, document.documentElement);
            }
            else if (resultObject.action === "redirect") {
                // redirect
                document.location.href = resultObject.url;
                return;
            }
            // trigger spaNavigated event
            var spaNavigatedArgs = new RedwoodSpaNavigatedEventArgs(viewModel, viewModelName, resultObject);
            _this.events.spaNavigated.trigger(spaNavigatedArgs);
            if (!isSuccess && !spaNavigatedArgs.isHandled) {
                throw "Invalid response from server!";
            }
        }, function (xhr) {
            // if another postback has already been passed, don't do anything
            if (!_this.isPostBackStillActive(currentPostBackCounter))
                return;
            // execute error handlers
            var errArgs = new RedwoodErrorEventArgs(viewModel, xhr, true);
            _this.events.error.trigger(errArgs);
            if (!errArgs.handled) {
                alert(xhr.responseText);
            }
        });
    };
    Redwood.prototype.patch = function (source, patch) {
        var _this = this;
        if (source instanceof Array && patch instanceof Array) {
            return patch.map(function (val, i) { return _this.patch(source[i], val); });
        }
        else if (source instanceof Array || patch instanceof Array)
            return patch;
        else if (typeof source == "object" && typeof patch == "object") {
            for (var p in patch) {
                if (patch[p] == null)
                    delete source[p];
                else
                    source[p] = this.patch(source[p], patch[p]);
            }
        }
        else
            return patch;
        return source;
    };
    Redwood.prototype.formatString = function (format, value) {
        if (format == "g") {
            return redwood.formatString("d", value) + " " + redwood.formatString("t", value);
        }
        else if (format == "G") {
            return redwood.formatString("d", value) + " " + redwood.formatString("T", value);
        }
        value = ko.unwrap(value);
        if (typeof value === "string" && value.match("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?$")) {
            // JSON date in string
            value = new Date(value);
        }
        return Globalize.format(value, format, redwood.culture);
    };
    Redwood.prototype.getDataSourceItems = function (viewModel) {
        var value = ko.unwrap(viewModel);
        return value.Items || value;
    };
    Redwood.prototype.updateDynamicPathFragments = function (sender, path) {
        var context = ko.contextFor(sender);
        for (var i = path.length - 1; i >= 0; i--) {
            if (path[i].indexOf("[$index]") >= 0) {
                path[i] = path[i].replace("[$index]", "[" + context.$index() + "]");
            }
            context = context.$parentContext;
        }
    };
    Redwood.prototype.postJSON = function (url, method, postData, success, error) {
        var xhr = this.getXHR();
        xhr.open(method, url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function () {
            if (xhr.readyState != 4)
                return;
            if (xhr.status < 400) {
                success(xhr);
            }
            else {
                error(xhr);
            }
        };
        xhr.send(postData);
    };
    Redwood.prototype.getJSON = function (url, method, spaPlaceHolderUniqueId, success, error) {
        var xhr = this.getXHR();
        xhr.open(method, url, true);
        xhr.open("GET", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("X-Redwood-SpaContentPlaceHolder", spaPlaceHolderUniqueId);
        xhr.onreadystatechange = function () {
            if (xhr.readyState != 4)
                return;
            if (xhr.status < 400) {
                success(xhr);
            }
            else {
                error(xhr);
            }
        };
        xhr.send();
    };
    Redwood.prototype.getXHR = function () {
        return XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    };
    Redwood.prototype.cleanUpdatedControls = function (resultObject) {
        var updatedControls = {};
        for (var id in resultObject.updatedControls) {
            if (resultObject.updatedControls.hasOwnProperty(id)) {
                var control = document.getElementById(id);
                var nextSibling = control.nextSibling;
                var parent = control.parentNode;
                ko.removeNode(control);
                updatedControls[id] = { control: control, nextSibling: nextSibling, parent: parent };
            }
        }
        return updatedControls;
    };
    Redwood.prototype.restoreUpdatedControls = function (resultObject, updatedControls, applyBindingsOnEachControl) {
        for (var id in resultObject.updatedControls) {
            if (resultObject.updatedControls.hasOwnProperty(id)) {
                var updatedControl = updatedControls[id];
                if (updatedControl.nextSibling) {
                    updatedControl.parent.insertBefore(updatedControl.control, updatedControl.nextSibling);
                }
                else {
                    updatedControl.parent.appendChild(updatedControl.control);
                }
                updatedControl.control.outerHTML = resultObject.updatedControls[id];
                if (applyBindingsOnEachControl) {
                    ko.applyBindings(ko.dataFor(updatedControl.parent), updatedControl.control);
                }
            }
        }
    };
    Redwood.prototype.buildRouteUrl = function (routePath, params) {
        return routePath.replace(/\{[^\}]+\}/g, function (s) { return params[s.substring(1, s.length - 1)] || ""; });
    };
    return Redwood;
})();
// RedwoodEvent is used because CustomEvent is not browser compatible and does not support 
// calling missed events for handler that subscribed too late.
var RedwoodEvent = (function () {
    function RedwoodEvent(name, triggerMissedEventsOnSubscribe) {
        if (triggerMissedEventsOnSubscribe === void 0) { triggerMissedEventsOnSubscribe = false; }
        this.name = name;
        this.triggerMissedEventsOnSubscribe = triggerMissedEventsOnSubscribe;
        this.handlers = [];
        this.history = [];
    }
    RedwoodEvent.prototype.subscribe = function (handler) {
        this.handlers.push(handler);
        if (this.triggerMissedEventsOnSubscribe) {
            for (var i = 0; i < this.history.length; i++) {
                handler(history[i]);
            }
        }
    };
    RedwoodEvent.prototype.unsubscribe = function (handler) {
        var index = this.handlers.indexOf(handler);
        if (index >= 0) {
            this.handlers = this.handlers.splice(index, 1);
        }
    };
    RedwoodEvent.prototype.trigger = function (data) {
        for (var i = 0; i < this.handlers.length; i++) {
            this.handlers[i](data);
        }
        if (this.triggerMissedEventsOnSubscribe) {
            this.history.push(data);
        }
    };
    return RedwoodEvent;
})();
var RedwoodEventArgs = (function () {
    function RedwoodEventArgs(viewModel) {
        this.viewModel = viewModel;
    }
    return RedwoodEventArgs;
})();
var RedwoodErrorEventArgs = (function (_super) {
    __extends(RedwoodErrorEventArgs, _super);
    function RedwoodErrorEventArgs(viewModel, xhr, isSpaNavigationError) {
        if (isSpaNavigationError === void 0) { isSpaNavigationError = false; }
        _super.call(this, viewModel);
        this.viewModel = viewModel;
        this.xhr = xhr;
        this.isSpaNavigationError = isSpaNavigationError;
        this.handled = false;
    }
    return RedwoodErrorEventArgs;
})(RedwoodEventArgs);
var RedwoodBeforePostBackEventArgs = (function (_super) {
    __extends(RedwoodBeforePostBackEventArgs, _super);
    function RedwoodBeforePostBackEventArgs(sender, viewModel, viewModelName, validationTargetPath) {
        _super.call(this, viewModel);
        this.sender = sender;
        this.viewModel = viewModel;
        this.viewModelName = viewModelName;
        this.validationTargetPath = validationTargetPath;
        this.cancel = false;
        this.clientValidationFailed = false;
    }
    return RedwoodBeforePostBackEventArgs;
})(RedwoodEventArgs);
var RedwoodAfterPostBackEventArgs = (function (_super) {
    __extends(RedwoodAfterPostBackEventArgs, _super);
    function RedwoodAfterPostBackEventArgs(sender, viewModel, viewModelName, validationTargetPath, serverResponseObject) {
        _super.call(this, viewModel);
        this.sender = sender;
        this.viewModel = viewModel;
        this.viewModelName = viewModelName;
        this.validationTargetPath = validationTargetPath;
        this.serverResponseObject = serverResponseObject;
        this.isHandled = false;
        this.wasInterrupted = false;
    }
    return RedwoodAfterPostBackEventArgs;
})(RedwoodEventArgs);
var RedwoodSpaNavigatingEventArgs = (function (_super) {
    __extends(RedwoodSpaNavigatingEventArgs, _super);
    function RedwoodSpaNavigatingEventArgs(viewModel, viewModelName, newUrl) {
        _super.call(this, viewModel);
        this.viewModel = viewModel;
        this.viewModelName = viewModelName;
        this.newUrl = newUrl;
        this.cancel = false;
    }
    return RedwoodSpaNavigatingEventArgs;
})(RedwoodEventArgs);
var RedwoodSpaNavigatedEventArgs = (function (_super) {
    __extends(RedwoodSpaNavigatedEventArgs, _super);
    function RedwoodSpaNavigatedEventArgs(viewModel, viewModelName, serverResponseObject) {
        _super.call(this, viewModel);
        this.viewModel = viewModel;
        this.viewModelName = viewModelName;
        this.serverResponseObject = serverResponseObject;
        this.isHandled = false;
    }
    return RedwoodSpaNavigatedEventArgs;
})(RedwoodEventArgs);
var redwood = new Redwood();
// add knockout binding handler for update progress control
ko.bindingHandlers["redwoodUpdateProgressVisible"] = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        element.style.display = "none";
        redwood.events.beforePostback.subscribe(function (e) {
            element.style.display = "";
        });
        redwood.events.spaNavigating.subscribe(function (e) {
            element.style.display = "";
        });
        redwood.events.afterPostback.subscribe(function (e) {
            element.style.display = "none";
        });
        redwood.events.spaNavigated.subscribe(function (e) {
            element.style.display = "none";
        });
        redwood.events.error.subscribe(function (e) {
            element.style.display = "none";
        });
    }
};
//# sourceMappingURL=Redwood.js.map