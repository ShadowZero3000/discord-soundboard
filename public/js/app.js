function parseFailure(error) {
  vm.showModal(error.response.data)
}

function play(clip) {
  axios.get(`api/play/${clip}`)
    .catch(parseFailure)
}

function random(clip) {
  axios.get(`api/random/${clip}`)
    .catch(parseFailure)
}

var titleCaseMixin = {
  methods: {
    toTitleCase(str) {
      return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }
  }
}

var findClipMixin = {
  methods: {
    findClip: function(needle, haystack) {
      var searchString = needle
                            .replace(' ','[_-]*')
                            .replace(/[^A-z0-9_\-\*]/g,'')
      var clipList = []
      var regex = new RegExp(`.*${searchString}.*`, 'i')
      Object.keys(haystack).forEach(function(category) {
        var cat = haystack[category];
        Object.keys(cat).forEach(function(subcategory) {
          var subcat = cat[subcategory];
          Object.keys(subcat).forEach(function(clip) {
            if(clip.match(regex)) {
              clipList.push({"name": clip, "subcategory": subcategory, "category": category})
            }
          });
        });
      });
      return _.sortBy(clipList, "name");
    }
  }
}

Vue.component('favorites-box', {
  data: function() {
    return {}
  },
  mixins: [findClipMixin, titleCaseMixin],
  props: {
    clips: Object,
    favorites: Array
  }
})

Vue.component('heart', {
  data: function() {
    return {
      favorited: false,
    }
  },
  props: {
    clip: Object,
    favorites: Object
  },
  computed: {
    cls: function() {
      if(this.favorited) {
        return 'fas fa-heart'
      }
      return 'far fa-heart'
    }
  },
  mounted: function() {
    var heart = this
    this.$root.$on('initialFavoriteState', function(favoriteState){
      if(favoriteState.indexOf(heart.clip.name) > -1) {
        heart.favorited = true
        heart.$emit('favorite', heart.clip, false)
      }
    })
    this.$root.$on('syncFavorite'+heart.clip.name, function(clip, fav){
      if(clip.name == heart.clip.name && fav != heart.favorited) {
        heart.favorited = fav
      }
    })
  },
  methods: {
    favorite: function(){
      this.favorited = !this.favorited
      if(this.favorited) {
        this.$emit('favorite', this.clip);
      } else {
        this.$emit('unfavorite', this.clip);
      }
    }
  },
  template: `<b-btn variant="secondary" v-on:click="favorite"><span :class="cls"></span></b-btn>`
})

Vue.component('search-box', {
  data: function() {
    return {
      searchResults: null,
      searching: false,
      searchQuery: null,
      isTyping: false
    }
  },
  mixins: [findClipMixin, titleCaseMixin],
  props: {
    clips: Object
  },
  watch: {
    searchQuery: _.debounce(function() {
      this.isTyping = false;
    }, 500),
    isTyping: function(value) {
      if (!value) {
        this.find(value)
      }
    }
  },
  methods: {
    find: function(value) {
      if(this.searchQuery == "" || this.searchQuery.length == 1) {
        this.searching = false
        return
      }
      this.searchResults = this.findClip(this.searchQuery, this.clips)
      if(this.searchResults.length > 0) {
        this.searching = true;
      } else {
        this.searching = false;
      }
    },
    mouseOver(clip) {
      return clip.category
    }
  }
})
var vm = new Vue({
  el: '#vuewrapper',
  data () {
    return {
      category: null,
      clips: {},
      errorMessage: null,
      randomClips: [],
      sounds: null,
      subcategory: null,
      syncedCollapses: {},
      favorites: []
    }
  },
  computed: {
    sortedFavorites: function() {
      return this.favorites.sort(this.compareSort);
    },
    sortedClips: function() {
      // Not used, because this is the categories, etc...
      // Might want to use it later
      return Object.keys(this.clips).sort(this.compareSort)
    }
  },
  mixins: [titleCaseMixin],
  mounted () {
    this.refreshData()
    // Restore state of expansions
    this.$root.$on("bv::collapse::state", function(collapseId, isJustShown) {
      if(collapseId == 'random') { return }
      idbKeyval.get(collapseId).then(val => {
        if(val == undefined) {
          idbKeyval.set(collapseId, isJustShown)
        } else {
          var synced = collapseId in this.syncedCollapses
          if(!synced && val != isJustShown) {
            this.$root.$emit('bv::toggle::collapse', collapseId)
          } else {
            idbKeyval.set(collapseId, isJustShown)
          }
        }
        this.syncedCollapses[collapseId] = true
      })
    });

    var favorites = this.favorites
    idbKeyval.get("favorites").then(val => {
      if(val == undefined) {
        // Fresh set of favorites, so set it blank
        idbKeyval.set("favorites", [])
      } else {
        this.$root.$emit('initialFavoriteState', val)
      }
    }).catch(err => {
      console.log(err)
    })
  },
  methods: {
    addFavorite: function(clip, save=true){
      this.favorites.push(clip)
      // Unneeded at this point
      // this.$emit('syncFavorite'+clip.name, clip, true)
      if(save) {
        idbKeyval.set("favorites", this.favorites.map(a => a.name))
      }
    },
    compareSort(a, b) {
      if (a.name < b.name)
        return -1;
      if (a.name > b.name)
        return 1;
      return 0;
    },
    removeFavorite: function(clip){
      this.favorites.splice(this.favorites.indexOf(clip), 1)
      idbKeyval.set("favorites", this.favorites.map(a => a.name))
      this.$root.$emit('syncFavorite'+clip.name, clip, false)
    },
    refreshData() {
      axios
        .get('//'+window.location.host+'/api/clips')
        .then(response => {this.clips = response.data})
      axios
        .get('//'+window.location.host+'/api/clips/random')
        .then(response => {this.randomClips = response.data})
    },
    showModal(str) {
      this.errorMessage = str
      this.$refs.errorModal.show()
    }
  }
})

// NOTE: We probably want to use window.location.hostname + some port later

