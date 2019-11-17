<template>
  <div class="Form-field">
    <ValidationProvider
      :rules="rules"
      v-slot="{ errors }"
    >
      <label :for="_name" v-text="name"></label>
      <div class="nes-select is-dark">
        <select :id="_name" disabled>
          <option value="" hidden v-text="placeholder"></option>
          <option value="0" selected>Sky Airline</option>
        </select>
      </div>
      <div class="Form-error" v-if="errors[0]">
        {{ errors[0] }}
      </div>
    </ValidationProvider>
  </div>
</template>

<script>
import { ValidationProvider, extend, configure, localize } from 'vee-validate'
import { required } from 'vee-validate/dist/rules'

/**
 * Validation rules
 */
extend('required', required)

/**
 * Validation config
 */
configure({
  classes: {
    valid: 'is-success',
    invalid: 'is-error'
  }
})

localize({
  en: {
    messages: {
      required: 'Campo requerido'
    }
  }
})

export default {
  props: {
    initValue: {
      type: String,
      default: () => ''
    },
    name: {
      type: String,
      required: true
    },
    placeholder: {
      type: String,
      default: () => 'Seleccionar...'
    },
    rules: String
  },

  components: {
    ValidationProvider
  },

  computed: {
    _name () {
      return this.name.replace(/\s+/g, '-').trim().toLowerCase()
    }
  },

  data () {
    return {
      inputValue: this.initValue
    }
  },

  methods: {
    emitInput () {
      this.$emit('input', this.inputValue)
    }
  }
}
</script>

<style scoped>
.Form-field {
  color: var(--color-white);
  opacity: .4;
}

.Form-error {
  margin: .6em 0;
  font-size: .8rem;
}
</style>
