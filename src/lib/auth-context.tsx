import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAIL = 'cleciotecnologia@gmail.com';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          // Check for specific Super Admin email
          setIsSuperAdmin(user.email === SUPER_ADMIN_EMAIL);
          
          // Check for Unit Admin in Firestore
          try {
            const userDocRef = doc(db, 'usuarios', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
              setIsAdmin(userDoc.data().admin === true);
            } else {
              // Create the user document if it doesn't exist
              const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
              try {
                await setDoc(userDocRef, {
                  uid: user.uid,
                  email: user.email,
                  nome: user.displayName || 'Usuário',
                  admin: isSuperAdmin, // Default to true only if they are the super admin email
                  createdAt: serverTimestamp()
                });
                setIsAdmin(isSuperAdmin);
              } catch (createError) {
                console.error("Error creating user profile:", createError);
                // Fallback to email check if creation fails (rules might block it)
                setIsAdmin(isSuperAdmin);
              }
            }
          } catch (e: any) {
            if (e.code === "unavailable") {
              console.warn("Firestore offline. Tentando novamente...");
            } else {
              console.error("Erro ao verificar admin:", e);
            }
            // Fallback for connectivity issues
            setIsAdmin(user.email === SUPER_ADMIN_EMAIL);
          }
        } else {
          setIsAdmin(false);
          setIsSuperAdmin(false);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isSuperAdmin, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
