import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  Building2,

  Briefcase,
  Hash,
  Check,
  Star,
  Zap,
  Crown,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import AddressFields from '@/components/AddressFields';
import PhoneField from '@/components/PhoneField';
import { PLANS, PLAN_ORDER, type PlanId } from '@/config/plans';

type AuthMode = 'login' | 'register' | 'forgot';
type RegisterStep = 1 | 2 | 3;
type PlanType = PlanId;

const SECTORS = [
  'Commerce',
  'Services',
  'BTP',
  'Restauration',
  'Santé',
  'Transport',
  'Industrie',
  'Autre',
];

interface StepErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  companyName?: string;
  siret?: string;
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [companyName, setCompanyName] = useState<string>('');
  const [sector, setSector] = useState<string>('');
  const [siret, setSiret] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [country, setCountry] = useState<string>('France');
  const [phone, setPhone] = useState<string>('');
  const [showSectorDropdown, setShowSectorDropdown] = useState<boolean>(false);

  const [selectedPlan, setSelectedPlan] = useState<PlanType>('solo');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<StepErrors>({});

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const stepAnim = useRef(new Animated.Value(0)).current;

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const companyRef = useRef<TextInput>(null);
  const siretRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const _phoneRef = useRef<TextInput>(null);

  const switchMode = useCallback((newMode: AuthMode) => {
    setError('');
    setFieldErrors({});
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setCompanyName('');
    setSector('');
    setSiret('');
    setAddress('');
    setPostalCode('');
    setCity('');
    setCountry('France');
    setPhone('');
    setSelectedPlan('solo');
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setMode(newMode);
      if (newMode === 'register') {
        setRegisterStep(1);
      }
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const animateStepTransition = useCallback((direction: 'forward' | 'backward') => {
    const startVal = direction === 'forward' ? 30 : -30;
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(stepAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    stepAnim.setValue(startVal);
  }, [fadeAnim, stepAnim]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const validateLogin = useCallback((): boolean => {
    if (!email.trim()) {
      setError('Veuillez saisir votre email');
      triggerShake();
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Format d\'email invalide');
      triggerShake();
      return false;
    }
    if (!password) {
      setError('Veuillez saisir votre mot de passe');
      triggerShake();
      return false;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      triggerShake();
      return false;
    }
    return true;
  }, [email, password, triggerShake]);

  const validateForgot = useCallback((): boolean => {
    if (!email.trim()) {
      setError('Veuillez saisir votre email');
      triggerShake();
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Format d\'email invalide');
      triggerShake();
      return false;
    }
    return true;
  }, [email, triggerShake]);

  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      digit: /\d/.test(password),
      special: /[!@#$%^&*()_+\-={}|;:',.<>?~`]/.test(password),
    };
  }, [password]);

  const passwordStrength = useMemo(() => {
    const count = Object.values(passwordChecks).filter(Boolean).length;
    return count;
  }, [passwordChecks]);

  const validateStep1 = useCallback((): boolean => {
    const errors: StepErrors = {};
    let valid = true;

    if (!fullName.trim()) {
      errors.fullName = 'Le nom est requis';
      valid = false;
    }
    if (!email.trim()) {
      errors.email = 'L\'email est requis';
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Format d\'email invalide';
      valid = false;
    }
    if (!password) {
      errors.password = 'Le mot de passe est requis';
      valid = false;
    } else if (password.length < 8) {
      errors.password = 'Minimum 8 caractères';
      valid = false;
    } else if (!/[A-Z]/.test(password)) {
      errors.password = '1 majuscule requise';
      valid = false;
    } else if (!/\d/.test(password)) {
      errors.password = '1 chiffre requis';
      valid = false;
    } else if (!/[!@#$%^&*()_+\-={}|;:',.<>?~`]/.test(password)) {
      errors.password = '1 caractère spécial requis';
      valid = false;
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirmez le mot de passe';
      valid = false;
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
      valid = false;
    }

    setFieldErrors(errors);
    if (!valid) triggerShake();
    return valid;
  }, [fullName, email, password, confirmPassword, triggerShake]);

  const validateStep2 = useCallback((): boolean => {
    const errors: StepErrors = {};
    let valid = true;

    if (!companyName.trim()) {
      errors.companyName = 'Le nom de l\'entreprise est requis';
      valid = false;
    }
    if (siret && !/^\d{14}$/.test(siret.replace(/\s/g, ''))) {
      errors.siret = 'Le SIRET doit contenir 14 chiffres';
      valid = false;
    }

    setFieldErrors(errors);
    if (!valid) triggerShake();
    return valid;
  }, [companyName, siret, triggerShake]);

  const goToStep = useCallback((step: RegisterStep, direction: 'forward' | 'backward') => {
    setError('');
    setFieldErrors({});
    setRegisterStep(step);
    animateStepTransition(direction);
  }, [animateStepTransition]);

  const handleNextStep = useCallback(() => {
    if (registerStep === 1 && validateStep1()) {
      goToStep(2, 'forward');
    } else if (registerStep === 2 && validateStep2()) {
      goToStep(3, 'forward');
    }
  }, [registerStep, validateStep1, validateStep2, goToStep]);

  const handlePrevStep = useCallback(() => {
    if (registerStep === 2) {
      goToStep(1, 'backward');
    } else if (registerStep === 3) {
      goToStep(2, 'backward');
    }
  }, [registerStep, goToStep]);

  const handleSubmit = useCallback(async () => {
    setError('');

    if (mode === 'login') {
      if (!validateLogin()) return;
    } else if (mode === 'forgot') {
      if (!validateForgot()) return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await signIn(email.trim(), password);
        if (!result.success) {
          const msg = result.error ?? 'Erreur de connexion';
          if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('invalid')) {
            setError('Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.');
          } else if (msg.toLowerCase().includes('not confirmed') || msg.toLowerCase().includes('email not confirmed')) {
            setError('Veuillez confirmer votre email avant de vous connecter.');
          } else if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('introuvable')) {
            setError('Aucun compte trouvé avec cet email.');
          } else {
            setError(msg);
          }
          triggerShake();
        } else {
          router.replace('/');
        }
      } else if (mode === 'forgot') {
        const result = await resetPassword(email.trim());
        if (!result.success) {
          setError(result.error ?? 'Erreur lors de l\'envoi');
          triggerShake();
        } else {
          Alert.alert(
            'Email envoyé',
            'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
            [{ text: 'OK', onPress: () => switchMode('login') }]
          );
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, email, password, validateLogin, validateForgot, signIn, resetPassword, triggerShake, switchMode, router]);

  const handleRegisterSubmit = useCallback(async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const result = await signUp(email.trim(), password, fullName.trim(), {
        companyName: companyName.trim(),
        sector,
        siret: siret.replace(/\s/g, ''),
        address: address.trim(),
        postalCode: postalCode.trim(),
        city: city.trim(),
        country: country.trim(),
        phone: phone.trim(),
        plan: selectedPlan,
      });
      if (!result.success) {
        const errMsg = result.error ?? 'Erreur lors de l\'inscription';
        if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already been registered') || errMsg.toLowerCase().includes('email not confirmed')) {
          setError('Un email de confirmation vous a été envoyé. Veuillez valider votre compte avant de vous connecter.');
        } else {
          setError(errMsg);
        }
        triggerShake();
      } else {
        Alert.alert(
          'Inscription réussie',
          'Un email de confirmation vous a été envoyé. Veuillez valider votre compte avant de vous connecter.',
          [{ text: 'OK', onPress: () => switchMode('login') }]
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, fullName, selectedPlan, companyName, sector, siret, address, postalCode, city, country, phone, signUp, triggerShake, switchMode]);

  const title = mode === 'login' ? 'Connexion' : 'Mot de passe oublié';
  const subtitle = mode === 'login'
    ? 'Accédez à votre espace de gestion'
    : 'Recevez un lien de réinitialisation';
  const buttonLabel = mode === 'login' ? 'Se connecter' : 'Envoyer le lien';

  const renderProgressBar = useMemo(() => {
    const labels = ['Compte', 'Entreprise', 'Offre'];
    return (
      <View style={regStyles.progressContainer}>
        {labels.map((label, index) => {
          const stepNum = (index + 1) as RegisterStep;
          const isActive = registerStep === stepNum;
          const isCompleted = registerStep > stepNum;

          return (
            <View key={label} style={regStyles.progressStepWrapper}>
              <View style={regStyles.progressStepRow}>
                {index > 0 && (
                  <View
                    style={[
                      regStyles.progressLine,
                      (isActive || isCompleted) && regStyles.progressLineActive,
                    ]}
                  />
                )}
                <View
                  style={[
                    regStyles.progressDot,
                    isActive && regStyles.progressDotActive,
                    isCompleted && regStyles.progressDotCompleted,
                  ]}
                >
                  {isCompleted ? (
                    <Check size={12} color="#FFF" strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        regStyles.progressDotText,
                        (isActive || isCompleted) && regStyles.progressDotTextActive,
                      ]}
                    >
                      {stepNum}
                    </Text>
                  )}
                </View>
                {index < labels.length - 1 && (
                  <View
                    style={[
                      regStyles.progressLine,
                      isCompleted && regStyles.progressLineActive,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  regStyles.progressLabel,
                  isActive && regStyles.progressLabelActive,
                  isCompleted && regStyles.progressLabelCompleted,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }, [registerStep]);

  const renderFieldError = useCallback((errorKey: keyof StepErrors) => {
    if (!fieldErrors[errorKey]) return null;
    return <Text style={regStyles.fieldError}>{fieldErrors[errorKey]}</Text>;
  }, [fieldErrors]);

  const renderStep1 = () => (
    <View>
      <TouchableOpacity
        style={regStyles.backStepButton}
        onPress={() => switchMode('login')}
        activeOpacity={0.8}
      >
        <ArrowLeft size={18} color="#94A3B8" />
        <Text style={regStyles.backStepText}>Retour</Text>
      </TouchableOpacity>

      <Text style={regStyles.stepTitle}>Créez votre compte</Text>
      <Text style={regStyles.stepSubtitle}>Renseignez vos informations personnelles</Text>

      <View style={[styles.inputGroup, fieldErrors.fullName ? regStyles.inputError : null]}>
        <View style={styles.inputIcon}>
          <User size={18} color="#64748B" />
        </View>
        <TextInput
          ref={nameRef}
          style={styles.input}
          placeholder="Nom complet"
          placeholderTextColor="#64748B"
          value={fullName}
          onChangeText={(t) => { setFullName(t); setFieldErrors(prev => ({ ...prev, fullName: undefined })); }}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          testID="reg-name-input"
        />
      </View>
      {renderFieldError('fullName')}

      <View style={[styles.inputGroup, fieldErrors.email ? regStyles.inputError : null]}>
        <View style={styles.inputIcon}>
          <Mail size={18} color="#64748B" />
        </View>
        <TextInput
          ref={emailRef}
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={(t) => { setEmail(t); setFieldErrors(prev => ({ ...prev, email: undefined })); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          testID="reg-email-input"
        />
      </View>
      {renderFieldError('email')}

      <View style={[styles.inputGroup, fieldErrors.password ? regStyles.inputError : null]}>
        <View style={styles.inputIcon}>
          <Lock size={18} color="#64748B" />
        </View>
        <TextInput
          ref={passwordRef}
          style={[styles.input, styles.inputPassword]}
          placeholder="Mot de passe"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={(t) => { setPassword(t); setFieldErrors(prev => ({ ...prev, password: undefined })); }}
          secureTextEntry={!showPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmPasswordRef.current?.focus()}
          testID="reg-password-input"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(p => !p)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
        </TouchableOpacity>
      </View>
      {renderFieldError('password')}

      {password.length > 0 && (
        <View style={regStyles.passwordStrength}>
          <View style={regStyles.strengthBars}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  regStyles.strengthBar,
                  {
                    backgroundColor: i < passwordStrength
                      ? passwordStrength === 4 ? '#10B981' : passwordStrength === 3 ? '#22C55E' : passwordStrength === 2 ? '#F59E0B' : '#EF4444'
                      : '#334155',
                  },
                ]}
              />
            ))}
          </View>
          <View style={regStyles.strengthChecks}>
            <Text style={[regStyles.strengthCheck, { color: passwordChecks.length ? '#10B981' : '#64748B' }]}>
              {passwordChecks.length ? '✓' : '○'} 8+ caractères
            </Text>
            <Text style={[regStyles.strengthCheck, { color: passwordChecks.uppercase ? '#10B981' : '#64748B' }]}>
              {passwordChecks.uppercase ? '✓' : '○'} 1 majuscule
            </Text>
            <Text style={[regStyles.strengthCheck, { color: passwordChecks.digit ? '#10B981' : '#64748B' }]}>
              {passwordChecks.digit ? '✓' : '○'} 1 chiffre
            </Text>
            <Text style={[regStyles.strengthCheck, { color: passwordChecks.special ? '#10B981' : '#64748B' }]}>
              {passwordChecks.special ? '✓' : '○'} 1 caractère spécial
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.inputGroup, fieldErrors.confirmPassword ? regStyles.inputError : null]}>
        <View style={styles.inputIcon}>
          <Lock size={18} color="#64748B" />
        </View>
        <TextInput
          ref={confirmPasswordRef}
          style={[styles.input, styles.inputPassword]}
          placeholder="Confirmer le mot de passe"
          placeholderTextColor="#64748B"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); setFieldErrors(prev => ({ ...prev, confirmPassword: undefined })); }}
          secureTextEntry={!showConfirmPassword}
          returnKeyType="done"
          testID="reg-confirm-password-input"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowConfirmPassword(p => !p)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {showConfirmPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
        </TouchableOpacity>
      </View>
      {renderFieldError('confirmPassword')}

      <TouchableOpacity
        style={regStyles.nextButton}
        onPress={handleNextStep}
        activeOpacity={0.8}
        testID="reg-next-step1"
      >
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={regStyles.nextButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={regStyles.nextButtonText}>Suivant</Text>
          <ArrowRight size={18} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => {
    return (
    <View>
      <Text style={regStyles.stepTitle}>Votre entreprise</Text>
      <Text style={regStyles.stepSubtitle}>Informations sur votre activité</Text>

      <View style={[styles.inputGroup, fieldErrors.companyName ? regStyles.inputError : null]}>
        <View style={styles.inputIcon}>
          <Building2 size={18} color="#64748B" />
        </View>
        <TextInput
          ref={companyRef}
          style={styles.input}
          placeholder="Nom de l'entreprise *"
          placeholderTextColor="#64748B"
          value={companyName}
          onChangeText={(t) => { setCompanyName(t); setFieldErrors(prev => ({ ...prev, companyName: undefined })); }}
          returnKeyType="next"
          testID="reg-company-input"
        />
      </View>
      {renderFieldError('companyName')}

      <TouchableOpacity
        style={styles.inputGroup}
        onPress={() => setShowSectorDropdown(p => !p)}
        activeOpacity={0.8}
      >
        <View style={styles.inputIcon}>
          <Briefcase size={18} color="#64748B" />
        </View>
        <Text style={[regStyles.selectorText, !sector && regStyles.selectorPlaceholder]}>
          {sector || "Secteur d'activité"}
        </Text>
      </TouchableOpacity>

      {showSectorDropdown && (
        <View style={regStyles.dropdownContainer}>
          <ScrollView style={regStyles.dropdownScroll} nestedScrollEnabled>
            {SECTORS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[regStyles.dropdownItem, sector === s && regStyles.dropdownItemActive]}
                onPress={() => { setSector(s); setShowSectorDropdown(false); }}
              >
                <Text style={[regStyles.dropdownItemText, sector === s && regStyles.dropdownItemTextActive]}>
                  {s}
                </Text>
                {sector === s && <Check size={16} color="#3B82F6" />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.inputGroup, fieldErrors.siret ? regStyles.inputError : null]}>
        <View style={styles.inputIcon}>
          <Hash size={18} color="#64748B" />
        </View>
        <TextInput
          ref={siretRef}
          style={styles.input}
          placeholder="SIRET (optionnel)"
          placeholderTextColor="#64748B"
          value={siret}
          onChangeText={(t) => { setSiret(t.replace(/[^\d\s]/g, '')); setFieldErrors(prev => ({ ...prev, siret: undefined })); }}
          keyboardType="numeric"
          maxLength={17}
          returnKeyType="next"
          onSubmitEditing={() => addressRef.current?.focus()}
          testID="reg-siret-input"
        />
      </View>
      {renderFieldError('siret')}

      <View style={{ marginBottom: 12 }}>
        <AddressFields
          address={address}
          postalCode={postalCode}
          city={city}
          country={country}
          onAddressChange={setAddress}
          onPostalCodeChange={setPostalCode}
          onCityChange={setCity}
          onCountryChange={setCountry}
          addressLabel="Adresse (optionnel)"
        />
      </View>

      <View style={{ marginBottom: 12 }}>
        <PhoneField
          value={phone}
          onChangeText={setPhone}
          label="Téléphone (optionnel)"
          testID="reg-phone-input"
        />
      </View>

      <View style={regStyles.stepButtonRow}>
        <TouchableOpacity
          style={regStyles.backStepButton}
          onPress={handlePrevStep}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color="#94A3B8" />
          <Text style={regStyles.backStepText}>Retour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={regStyles.nextButtonSmall}
          onPress={handleNextStep}
          activeOpacity={0.8}
          testID="reg-next-step2"
        >
          <LinearGradient
            colors={['#2563EB', '#1D4ED8']}
            style={regStyles.nextButtonGradientSmall}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={regStyles.nextButtonText}>Suivant</Text>
            <ArrowRight size={18} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  const plans = useMemo(() => PLAN_ORDER.map((planId) => {
    const cfg = PLANS[planId];
    const iconMap: Record<PlanId, typeof Star> = { solo: Star, pro: Zap, business: Crown };
    return {
      id: planId,
      name: cfg.nameFr,
      price: `${cfg.monthlyPrice}€`,
      priceDetail: '/mois',
      icon: iconMap[planId],
      color: cfg.color,
      features: cfg.features.filter(f => f.included).map(f => f.labelFr),
      popular: cfg.popular,
    };
  }), []);

  const renderStep3 = () => (
    <View>
      <Text style={regStyles.stepTitle}>Choisir une offre</Text>
      <Text style={regStyles.stepSubtitle}>Sélectionnez le plan adapté à vos besoins</Text>

      {plans.map((plan) => {
        const isSelected = selectedPlan === plan.id;
        const IconComp = plan.icon;

        return (
          <TouchableOpacity
            key={plan.id}
            style={[
              regStyles.planCard,
              isSelected && { borderColor: plan.color, borderWidth: 2 },
              plan.popular && !isSelected && regStyles.planCardPopular,
            ]}
            onPress={() => setSelectedPlan(plan.id)}
            activeOpacity={0.8}
            testID={`reg-plan-${plan.id}`}
          >
            {plan.popular && (
              <View style={[regStyles.popularBadge, { backgroundColor: plan.color }]}>
                <Text style={regStyles.popularBadgeText}>Populaire</Text>
              </View>
            )}

            {isSelected && (
              <View style={[regStyles.selectedBadge, { backgroundColor: plan.color }]}>
                <Check size={12} color="#FFF" strokeWidth={3} />
                <Text style={regStyles.selectedBadgeText}>Sélectionné</Text>
              </View>
            )}

            <View style={regStyles.planHeader}>
              <View style={[regStyles.planIconWrap, { backgroundColor: plan.color + '20' }]}>
                <IconComp size={20} color={plan.color} />
              </View>
              <View style={regStyles.planTitleWrap}>
                <Text style={regStyles.planName}>{plan.name}</Text>
                <View style={regStyles.planPriceRow}>
                  <Text style={[regStyles.planPrice, { color: plan.color }]}>{plan.price}</Text>
                  {plan.priceDetail ? (
                    <Text style={regStyles.planPriceDetail}>{plan.priceDetail}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={regStyles.planFeatures}>
              {plan.features.map((f) => (
                <View key={f} style={regStyles.planFeatureRow}>
                  <Check size={14} color={plan.color} />
                  <Text style={regStyles.planFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={regStyles.stepButtonRow}>
        <TouchableOpacity
          style={regStyles.backStepButton}
          onPress={handlePrevStep}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color="#94A3B8" />
          <Text style={regStyles.backStepText}>Retour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[regStyles.nextButtonSmall, isSubmitting && { opacity: 0.7 }]}
          onPress={handleRegisterSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
          testID="reg-submit"
        >
          <LinearGradient
            colors={isSubmitting ? ['#475569', '#475569'] : ['#2563EB', '#1D4ED8']}
            style={regStyles.nextButtonGradientSmall}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={regStyles.nextButtonText}>Créer mon compte</Text>
                <Check size={18} color="#FFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRegisterFlow = () => (
    <Animated.View
      style={[
        styles.formCard,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: shakeAnim },
          ],
        },
      ]}
    >
      {renderProgressBar}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Animated.View style={{ transform: [{ translateX: stepAnim }] }}>
        {registerStep === 1 && renderStep1()}
        {registerStep === 2 && renderStep2()}
        {registerStep === 3 && renderStep3()}
      </Animated.View>
    </Animated.View>
  );

  const renderLoginForgot = () => (
    <Animated.View
      style={[
        styles.formCard,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { translateX: shakeAnim },
          ],
        },
      ]}
    >
      {mode !== 'login' && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => switchMode('login')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={20} color="#94A3B8" />
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.formTitle}>{title}</Text>
      <Text style={styles.formSubtitle}>{subtitle}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <View style={styles.inputIcon}>
          <Mail size={18} color="#64748B" />
        </View>
        <TextInput
          ref={emailRef}
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={mode === 'forgot' ? 'done' : 'next'}
          onSubmitEditing={() => mode === 'forgot' ? handleSubmit() : passwordRef.current?.focus()}
          testID="auth-email-input"
        />
      </View>

      {mode !== 'forgot' && (
        <View style={styles.inputGroup}>
          <View style={styles.inputIcon}>
            <Lock size={18} color="#64748B" />
          </View>
          <TextInput
            ref={passwordRef}
            style={[styles.input, styles.inputPassword]}
            placeholder="Mot de passe"
            placeholderTextColor="#64748B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            testID="auth-password-input"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword((p) => !p)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showPassword ? (
              <EyeOff size={18} color="#64748B" />
            ) : (
              <Eye size={18} color="#64748B" />
            )}
          </TouchableOpacity>
        </View>
      )}

      {mode === 'login' && (
        <TouchableOpacity
          style={styles.forgotLink}
          onPress={() => switchMode('forgot')}
        >
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
        testID="auth-submit-button"
      >
        <LinearGradient
          colors={isSubmitting ? ['#475569', '#475569'] : ['#2563EB', '#1D4ED8']}
          style={styles.submitGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.submitText}>{buttonLabel}</Text>
              <ArrowRight size={18} color="#FFF" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.topDecor, { top: insets.top + 20 }]}>
        <View style={styles.decorDot1} />
        <View style={styles.decorDot2} />
        <View style={styles.decorDot3} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + (mode === 'register' ? 30 : 60),
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#2563EB', '#3B82F6']}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.logoText}>H</Text>
              </LinearGradient>
            </View>
            <Text style={styles.brandName}>HaziOne</Text>
            {mode !== 'register' && (
              <Text style={styles.brandTagline}>Gestion d'entreprise simplifiée</Text>
            )}
          </View>

          {mode === 'register' ? renderRegisterFlow() : renderLoginForgot()}

          <View style={styles.footer}>
            {mode === 'login' ? (
              <TouchableOpacity onPress={() => switchMode('register')}>
                <Text style={styles.footerText}>
                  Pas encore de compte ?{' '}
                  <Text style={styles.footerLink}>Créer un compte</Text>
                </Text>
              </TouchableOpacity>
            ) : mode === 'register' ? (
              <TouchableOpacity onPress={() => switchMode('login')}>
                <Text style={styles.footerText}>
                  Déjà un compte ?{' '}
                  <Text style={styles.footerLink}>Se connecter</Text>
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const regStyles = StyleSheet.create({
  progressContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  progressStepWrapper: {
    flex: 1,
    alignItems: 'center' as const,
  },
  progressStepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: '100%',
    justifyContent: 'center' as const,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    borderRadius: 1,
  },
  progressLineActive: {
    backgroundColor: '#3B82F6',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  progressDotActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#172554',
  },
  progressDotCompleted: {
    borderColor: '#3B82F6',
    backgroundColor: '#2563EB',
  },
  progressDotText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  progressDotTextActive: {
    color: '#3B82F6',
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '500' as const,
  },
  progressLabelActive: {
    color: '#3B82F6',
    fontWeight: '600' as const,
  },
  progressLabelCompleted: {
    color: '#94A3B8',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  fieldError: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4,
  },
  nextButton: {
    borderRadius: 12,
    overflow: 'hidden' as const,
    marginTop: 8,
  },
  nextButtonGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 15,
    gap: 8,
  },
  nextButtonSmall: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  nextButtonGradientSmall: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  stepButtonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginTop: 16,
  },
  backStepButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backStepText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  selectorText: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    paddingRight: 16,
  },
  selectorPlaceholder: {
    color: '#64748B',
  },
  dropdownContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    marginTop: -4,
    overflow: 'hidden' as const,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  dropdownItemActive: {
    backgroundColor: '#172554',
  },
  dropdownItemText: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  dropdownItemTextActive: {
    color: '#3B82F6',
    fontWeight: '600' as const,
  },
  planCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  planCardPopular: {
    borderColor: '#1E40AF',
  },
  popularBadge: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  selectedBadge: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  selectedBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  planHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  planIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  planTitleWrap: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  planPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 2,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  planPriceDetail: {
    fontSize: 13,
    color: '#64748B',
  },
  planFeatures: {
    gap: 6,
  },
  planFeatureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  planFeatureText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  passwordStrength: {
    marginTop: -4,
    marginBottom: 8,
    gap: 6,
  },
  strengthBars: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthChecks: {
    flexDirection: 'row' as const,
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  strengthCheck: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  flex: {
    flex: 1,
  },
  topDecor: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: 200,
    overflow: 'hidden',
    zIndex: 0,
  },
  decorDot1: {
    position: 'absolute' as const,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    top: -20,
    right: -30,
  },
  decorDot2: {
    position: 'absolute' as const,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    top: 60,
    left: 20,
  },
  decorDot3: {
    position: 'absolute' as const,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    top: 30,
    right: 80,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  brandSection: {
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  logoContainer: {
    marginBottom: 12,
  },
  logoGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  brandName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    gap: 4,
  },
  backText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  inputGroup: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    height: 52,
  },
  inputIcon: {
    width: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#F1F5F9',
    fontSize: 15,
    paddingRight: 16,
  },
  inputPassword: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute' as const,
    right: 14,
    height: 52,
    justifyContent: 'center' as const,
  },
  forgotLink: {
    alignSelf: 'flex-end' as const,
    marginBottom: 20,
    marginTop: 4,
  },
  forgotText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden' as const,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 15,
    gap: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  footer: {
    alignItems: 'center' as const,
    marginTop: 24,
  },
  footerText: {
    color: '#64748B',
    fontSize: 14,
  },
  footerLink: {
    color: '#3B82F6',
    fontWeight: '600' as const,
  },
});
